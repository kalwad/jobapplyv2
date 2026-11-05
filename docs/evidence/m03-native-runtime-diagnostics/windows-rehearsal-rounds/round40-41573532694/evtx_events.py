"""DIAGNOSTIC SCRATCH ONLY - never merge.

Select boot, shutdown, crash and licensing events from a Windows .evtx log.
usage: evtx_events.py LOG.evtx > events.json  (needs python-evtx)
"""

import json
import re
import sys

import Evtx.Evtx as evtx

IDS = {"12", "13", "41", "109", "1001", "1074", "1076", "6005", "6006", "6008", "6009", "6013", "161", "46", "49", "50"}
PROVIDERS = re.compile(r"WLMS|Licens|Kernel-Power|BugCheck|Kernel-General|EventLog|User32|WER|Windows Error Reporting|volmgr|Wininit", re.I)
rows = []
with evtx.Evtx(sys.argv[1]) as log:
    for record in log.records():
        try:
            xml = record.xml()
        except Exception as error:  # noqa: BLE001
            rows.append({"error": type(error).__name__})
            continue
        provider = re.search(r'<Provider Name="([^"]*)"', xml)
        event_id = re.search(r"<EventID[^>]*>(\d+)</EventID>", xml)
        when = re.search(r'SystemTime="([^"]*)"', xml)
        name = provider.group(1) if provider else ""
        number = event_id.group(1) if event_id else ""
        if number in IDS or PROVIDERS.search(name):
            data = re.findall(r"<Data(?: Name=\"([^\"]*)\")?>([^<]*)</Data>", xml)
            rows.append({"time": when.group(1) if when else "", "provider": name, "id": number, "data": [[k, v[:300]] for k, v in data][:24]})
print(json.dumps(rows[-400:], indent=1))
