"""Authenticated local service skeleton with explicitly owned lifespan."""

from collections.abc import AsyncIterator, Callable, Mapping
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from dataclasses import dataclass
from importlib.metadata import version

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from japp_contracts.service.health_v1 import ServiceHealthV1
from japp_contracts.service.ready_v1 import ServiceReadyV1
from japp_contracts.service.version_v1 import ServiceVersionV1
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse

from orchestrator.boundary import AuthenticatedBoundary
from orchestrator.config import ServiceConfiguration
from orchestrator.responses import API_VERSION, failure_response, record_response

ResourceFactory = Callable[[], AbstractAsyncContextManager[None]]


@dataclass
class LifecycleState:
    live: bool = False
    ready: bool = False


@asynccontextmanager
async def skeleton_resources() -> AsyncIterator[None]:
    """W02 owns only the service lifecycle, without model/database readiness claims."""
    yield


def create_app(
    configuration: Mapping[str, object],
    *,
    resource_factory: ResourceFactory | None = None,
) -> FastAPI:
    settings = ServiceConfiguration.model_validate(configuration)
    lifecycle = LifecycleState()
    resources = resource_factory or skeleton_resources

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        async with resources():
            lifecycle.live = True
            lifecycle.ready = True
            try:
                yield
            finally:
                lifecycle.ready = False
                lifecycle.live = False

    app = FastAPI(
        debug=False,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        swagger_ui_oauth2_redirect_url=None,
        lifespan=lifespan,
        telemetry={
            "tracing": False,
            "metrics": False,
            "logs": False,
            "operation_spans": False,
            "auto_configure": False,
        },
    )
    app.state.lifecycle = lifecycle
    app.add_middleware(AuthenticatedBoundary, configuration=settings)

    @app.exception_handler(HTTPException)
    async def protocol_error(
        request: Request, exception: HTTPException
    ) -> JSONResponse:
        return failure_response(
            "TRANSPORT_PROTOCOL_MISMATCH",
            exception.status_code,
            request.state.correlation_id,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(
        request: Request, _exception: RequestValidationError
    ) -> JSONResponse:
        return failure_response(
            "VALIDATION_CONSTRAINT_VIOLATION", 400, request.state.correlation_id
        )

    @app.exception_handler(Exception)
    async def unavailable(request: Request, _exception: Exception) -> JSONResponse:
        return failure_response(
            "TRANSPORT_SERVICE_UNAVAILABLE", 503, request.state.correlation_id
        )

    @app.get("/api/v1/health", response_model=None)
    async def health(request: Request) -> JSONResponse:
        if not lifecycle.live:
            return await unavailable(request, RuntimeError())
        payload = ServiceHealthV1(
            status="LIVE",
            scope="SERVICE_SKELETON",
            instance_id=settings.instance_id,
            generation=settings.generation,
        )
        return record_response(
            payload, "urn:japp:schema:service:health:v1", request.state.correlation_id
        )

    @app.get("/api/v1/ready", response_model=None)
    async def ready(request: Request) -> JSONResponse:
        if not lifecycle.ready:
            return await unavailable(request, RuntimeError())
        payload = ServiceReadyV1(
            status="READY",
            scope="SERVICE_SKELETON",
            instance_id=settings.instance_id,
            generation=settings.generation,
        )
        return record_response(
            payload, "urn:japp:schema:service:ready:v1", request.state.correlation_id
        )

    @app.get("/api/v1/version", response_model=None)
    async def service_version(request: Request) -> JSONResponse:
        payload = ServiceVersionV1(
            service_version=version("orchestrator"),
            api_version=API_VERSION,
            instance_id=settings.instance_id,
            generation=settings.generation,
        )
        return record_response(
            payload, "urn:japp:schema:service:version:v1", request.state.correlation_id
        )

    return app
