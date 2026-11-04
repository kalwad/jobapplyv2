#!/usr/bin/env bash
# DIAGNOSTIC SCRATCH ONLY - never merge. Run as root after QEMU has exited:
# read the disposable VM disk read-only and copy the crash/boot records out.
# usage: forensics.sh OS_QCOW2 DEST
set -uo pipefail
disk="$1"; dest="$2"
mkdir -p "$dest/raw"
log() { echo "$(date -u +%FT%TZ) $*" >> "$dest/forensics.log"; }
log "start"
modprobe nbd max_part=16 >> "$dest/forensics.log" 2>&1 || log "modprobe nbd failed"
if ! qemu-nbd --read-only --connect=/dev/nbd0 "$disk" >> "$dest/forensics.log" 2>&1; then log "qemu-nbd failed"; chown -R "$SUDO_UID:$SUDO_GID" "$dest"; exit 0; fi
sleep 3; partprobe /dev/nbd0 >> "$dest/forensics.log" 2>&1; sleep 2
lsblk -o NAME,FSTYPE,SIZE,LABEL /dev/nbd0 >> "$dest/forensics.log" 2>&1
part=$(lsblk -lnbpo NAME,FSTYPE,SIZE /dev/nbd0 | awk '$2=="ntfs"{print $3, $1}' | sort -n | tail -1 | awk '{print $2}')
log "windows partition: ${part:-none}"
mkdir -p /mnt/win
if ! { mount -t ntfs3 -o ro "$part" /mnt/win >> "$dest/forensics.log" 2>&1 || ntfs-3g -o ro "$part" /mnt/win >> "$dest/forensics.log" 2>&1; }; then
  log "mount failed"; qemu-nbd -d /dev/nbd0 >> "$dest/forensics.log" 2>&1; chown -R "$SUDO_UID:$SUDO_GID" "$dest"; exit 0
fi
W=/mnt/win/Windows
ls -la --time-style=full-iso "$W/Minidump" "$W/LiveKernelReports" >> "$dest/forensics.log" 2>&1
ls -la --time-style=full-iso "$W/MEMORY.DMP" >> "$dest/forensics.log" 2>&1
cp "$W"/Minidump/*.dmp "$dest/raw/" >> "$dest/forensics.log" 2>&1
for name in System Application Setup; do cp "$W/System32/winevt/Logs/$name.evtx" "$dest/raw/" >> "$dest/forensics.log" 2>&1; done
find /mnt/win/Users -maxdepth 6 \( -path '*AppData/Local/JobApply*' -o -path '*AppData/Local/CrashDumps*' \) -printf '%TY-%Tm-%TdT%TH:%TM:%TS %s %p\n' 2>/dev/null | head -300 > "$dest/user-files.txt"
umount /mnt/win >> "$dest/forensics.log" 2>&1
qemu-nbd -d /dev/nbd0 >> "$dest/forensics.log" 2>&1
log "done"
chown -R "$SUDO_UID:$SUDO_GID" "$dest"
