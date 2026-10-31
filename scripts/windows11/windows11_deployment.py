"""Supported Unattend answer file for one fresh, isolated evaluation guest.

No bypass registry keys, online account, existing disk or external identity.
The generated password is only for the disposable local test account and must
remain in private VM scratch, never in retained evidence.
"""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET

NAMESPACE = "urn:schemas-microsoft-com:unattend"
WCM = "http://schemas.microsoft.com/WMIConfig/2002/State"
ACCOUNT = "JappFixture"
ET.register_namespace("", NAMESPACE)
ET.register_namespace("wcm", WCM)


def answer_file(password: str, image_name: str) -> bytes:  # noqa: PLR0915 - closed declarative answer-file schema
    if re.fullmatch(r"[A-Za-z0-9_-]{32,96}", password) is None:
        raise ValueError("Fresh high-entropy disposable fixture password required")
    if image_name != "Windows 11 Enterprise Evaluation":
        raise ValueError("Exact reviewed Enterprise evaluation image required")
    root = ET.Element("{" + NAMESPACE + "}unattend")

    def element(
        parent: ET.Element, tag: str, text: str | None = None, **attrs: str
    ) -> ET.Element:
        node = ET.SubElement(parent, "{" + NAMESPACE + "}" + tag, attrs)
        node.text = text
        return node

    def component(parent: ET.Element, name: str) -> ET.Element:
        return element(
            parent,
            "component",
            name=name,
            processorArchitecture="amd64",
            publicKeyToken="31bf3856ad364e35",
            language="neutral",
            versionScope="nonSxS",
        )

    pe = element(root, "settings", **{"pass": "windowsPE"})
    international = component(pe, "Microsoft-Windows-International-Core-WinPE")
    for name in ("InputLocale", "SystemLocale", "UILanguage", "UserLocale"):
        element(international, name, "en-US")
    setup = component(pe, "Microsoft-Windows-Setup")
    disk_config = element(setup, "DiskConfiguration")
    disk = element(disk_config, "Disk", **{"{" + WCM + "}action": "add"})
    element(disk, "DiskID", "0")
    element(disk, "WillWipeDisk", "true")
    partitions = element(disk, "CreatePartitions")
    for order, kind, size in (
        (1, "EFI", "260"),
        (2, "MSR", "16"),
        (3, "Primary", None),
    ):
        partition = element(
            partitions, "CreatePartition", **{"{" + WCM + "}action": "add"}
        )
        element(partition, "Order", str(order))
        element(partition, "Type", kind)
        element(
            partition,
            "Extend" if size is None else "Size",
            "true" if size is None else size,
        )
    modifications = element(disk, "ModifyPartitions")
    for order, kind, label, letter in (
        (1, "FAT32", "System", None),
        (3, "NTFS", "Windows", "C"),
    ):
        item = element(
            modifications, "ModifyPartition", **{"{" + WCM + "}action": "add"}
        )
        element(item, "Order", str(order))
        element(item, "PartitionID", str(order))
        element(item, "Format", kind)
        element(item, "Label", label)
        if letter:
            element(item, "Letter", letter)
    install = element(element(setup, "ImageInstall"), "OSImage")
    metadata = element(
        element(install, "InstallFrom"), "MetaData", **{"{" + WCM + "}action": "add"}
    )
    element(metadata, "Key", "/IMAGE/NAME")
    element(metadata, "Value", image_name)
    target = element(install, "InstallTo")
    element(target, "DiskID", "0")
    element(target, "PartitionID", "3")
    element(element(setup, "UserData"), "AcceptEula", "true")

    specialize = element(root, "settings", **{"pass": "specialize"})
    deployment = component(specialize, "Microsoft-Windows-Deployment")
    command = element(
        element(deployment, "RunSynchronous"),
        "RunSynchronousCommand",
        **{"{" + WCM + "}action": "add"},
    )
    element(command, "Order", "1")
    element(command, "Description", "Prepare only the disposable validation guest")
    element(
        command,
        "Path",
        'powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -Command "'
        "$d=[IO.DriveInfo]::GetDrives() | "
        "Where-Object {$_.VolumeLabel -eq 'JAPP-SEED'}; "
        "if(@($d).Count -ne 1){exit 1}; "
        "& (Join-Path $d.RootDirectory.FullName 'windows11_bootstrap.ps1')\"",
    )

    oobe = element(root, "settings", **{"pass": "oobeSystem"})
    shell = component(oobe, "Microsoft-Windows-Shell-Setup")
    settings = element(shell, "OOBE")
    element(settings, "HideOnlineAccountScreens", "true")
    element(settings, "HideOEMRegistrationScreen", "true")
    element(settings, "ProtectYourPC", "1")
    account = element(
        element(element(shell, "UserAccounts"), "LocalAccounts"),
        "LocalAccount",
        **{"{" + WCM + "}action": "add"},
    )
    element(account, "Name", ACCOUNT)
    element(account, "DisplayName", "Disposable validation fixture")
    element(account, "Description", "Synthetic account for one isolated evaluation VM")
    element(account, "Group", "Users")
    secret = element(account, "Password")
    element(secret, "Value", password)
    element(secret, "PlainText", "true")
    login = element(shell, "AutoLogon")
    element(login, "Username", ACCOUNT)
    element(login, "Enabled", "true")
    element(login, "LogonCount", "1")
    secret = element(login, "Password")
    element(secret, "Value", password)
    element(secret, "PlainText", "true")
    serialized = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    if not isinstance(serialized, bytes):
        raise TypeError("Encoded Unattend must be bytes")
    return serialized
