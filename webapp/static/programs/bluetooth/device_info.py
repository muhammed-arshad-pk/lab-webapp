"""
Bluetooth Device Information
============================
Shows detailed information about a selected Bluetooth device:

  * Device Name
  * Device Type             (Class of Device for Classic, Appearance for BLE)
  * Available services
  * Service UUID
  * Service Name
  * Communication protocol  (protocol stack, e.g. L2CAP -> RFCOMM ch 5 -> OBEX)

Classic Bluetooth: services are read from the device's SDP (Service Discovery
Protocol) records. BLE: services are read from the device's GATT table.

Usage:
  python device_info.py                          # scan, then pick from a list
  python device_info.py AA:BB:CC:DD:EE:FF        # Classic device
  python device_info.py AA:BB:CC:DD:EE:FF --ble  # BLE device
"""

import argparse
import asyncio
import platform
import uuid

from discover_devices import device_class, discover_all, print_devices

BASE_UUID = "-0000-1000-8000-00805f9b34fb"

# Bluetooth SIG assigned numbers: SDP service classes / profiles
SERVICE_NAMES = {
    0x1000: "Service Discovery Server", 0x1101: "Serial Port (SPP)",
    0x1102: "LAN Access Using PPP", 0x1103: "Dial-up Networking",
    0x1104: "IrMC Sync", 0x1105: "OBEX Object Push", 0x1106: "OBEX File Transfer",
    0x1108: "Headset", 0x110A: "Audio Source (A2DP)", 0x110B: "Audio Sink (A2DP)",
    0x110C: "A/V Remote Control Target", 0x110D: "Advanced Audio Distribution",
    0x110E: "A/V Remote Control (AVRCP)", 0x110F: "A/V Remote Control Controller",
    0x1112: "Headset Audio Gateway", 0x1115: "PAN User (PANU)",
    0x1116: "Network Access Point (NAP)", 0x1117: "Group Network (GN)",
    0x111E: "Handsfree", 0x111F: "Handsfree Audio Gateway",
    0x1124: "Human Interface Device (HID)", 0x112D: "SIM Access",
    0x112F: "Phonebook Access Server (PBAP)", 0x1130: "Phonebook Access",
    0x1132: "Message Access Server (MAP)", 0x1133: "Message Notification Server",
    0x1134: "Message Access Profile", 0x1200: "PnP Information",
    0x1203: "Generic Audio", 0x1303: "Video Source", 0x1304: "Video Sink",
}

# Protocol UUIDs that appear in an SDP Protocol Descriptor List
PROTOCOLS = {0x0001: "SDP", 0x0003: "RFCOMM", 0x0005: "TCS-BIN", 0x0008: "OBEX",
             0x000F: "BNEP", 0x0011: "HIDP", 0x0017: "AVCTP", 0x0019: "AVDTP",
             0x001E: "MCAP", 0x0100: "L2CAP"}

# BLE Appearance categories (upper 10 bits of the 16-bit Appearance value)
APPEARANCE = {0: "Unknown", 1: "Phone", 2: "Computer", 3: "Watch", 4: "Clock",
              5: "Display", 6: "Remote Control", 7: "Eye-glasses", 8: "Tag",
              9: "Keyring", 10: "Media Player", 11: "Barcode Scanner",
              12: "Thermometer", 13: "Heart Rate Sensor", 14: "Blood Pressure",
              15: "Human Interface Device", 16: "Glucose Meter",
              17: "Running/Walking Sensor", 18: "Cycling Sensor",
              49: "Pulse Oximeter", 81: "Weight Scale", 83: "Audio Sink",
              84: "Audio Source"}

SERVICE_CLASS_BITS = {13: "Limited Discoverable", 16: "Positioning",
                      17: "Networking", 18: "Rendering", 19: "Capturing",
                      20: "Object Transfer", 21: "Audio", 22: "Telephony",
                      23: "Information"}

ATTR_PROTOCOL_LIST, ATTR_PROFILE_LIST, ATTR_SERVICE_NAME = 0x0004, 0x0009, 0x0100


def short_uuid(u: str):
    """Return the 16-bit id of a Bluetooth base UUID, else None."""
    u = str(u).lower()
    if u.endswith(BASE_UUID) and u.startswith("0000"):
        return int(u[4:8], 16)
    return None


# ---------------------------------------------------------------------------
# SDP data-element parser (Bluetooth Core Spec, Vol 3, Part B, Section 3)
# ---------------------------------------------------------------------------
def sdp_parse(data: bytes, pos: int = 0):
    header = data[pos]
    dtype, size_idx = header >> 3, header & 0x07
    pos += 1
    if dtype == 0:                                        # nil
        return None, pos
    if size_idx < 5:
        length = (1, 2, 4, 8, 16)[size_idx]
    else:
        n = (1, 2, 4)[size_idx - 5]
        length = int.from_bytes(data[pos:pos + n], "big")
        pos += n
    raw, end = data[pos:pos + length], pos + length

    if dtype in (1, 2):                                   # unsigned / signed int
        value = int.from_bytes(raw, "big", signed=dtype == 2)
    elif dtype == 3:                                      # UUID
        value = int.from_bytes(raw, "big") if length <= 4 else str(uuid.UUID(bytes=raw))
    elif dtype in (4, 8):                                 # text / URL
        value = raw.decode("utf-8", errors="replace").rstrip("\x00")
    elif dtype == 5:                                      # boolean
        value = bool(raw[0])
    elif dtype in (6, 7):                                 # sequence / alternative
        value, p = [], pos
        while p < end:
            item, p = sdp_parse(data, p)
            value.append(item)
    else:
        value = raw
    return value, end


def describe_protocols(descriptor_list):
    """[[0x0100], [0x0003, 5], [0x0008]] -> 'L2CAP -> RFCOMM (channel 5) -> OBEX'"""
    parts = []
    for entry in descriptor_list or []:
        if not isinstance(entry, list) or not entry:
            continue
        proto = entry[0]
        pid = proto if isinstance(proto, int) else short_uuid(proto)
        name = PROTOCOLS.get(pid, f"0x{pid:04X}" if isinstance(pid, int) else str(proto))
        if pid == 0x0003 and len(entry) > 1:
            name += f" (channel {entry[1]})"
        elif pid == 0x0100 and len(entry) > 1:
            name += f" (PSM 0x{entry[1]:04X})"
        parts.append(name)
    return " -> ".join(parts)


def buffer_to_bytes(buf) -> bytes:
    try:
        return bytes(buf)
    except TypeError:
        from winrt.windows.storage.streams import DataReader
        reader = DataReader.from_buffer(buf)
        out = bytearray(buf.length)
        reader.read_bytes(out)
        return bytes(out)


def map_items(winrt_map):
    if hasattr(winrt_map, "items"):
        return list(winrt_map.items())
    return [(kv.key, kv.value) for kv in winrt_map]


# ---------------------------------------------------------------------------
# Classic Bluetooth (Windows: WinRT RFCOMM + SDP)
# ---------------------------------------------------------------------------
async def classic_info_windows(address):
    from winrt.windows.devices.bluetooth import BluetoothCacheMode, BluetoothDevice

    dev = await BluetoothDevice.from_bluetooth_address_async(int(address.replace(":", ""), 16))
    if dev is None:
        raise RuntimeError(f"Device {address} not found. Is it on and in range?")

    cod = dev.class_of_device.raw_value
    services_cls = [n for bit, n in SERVICE_CLASS_BITS.items() if cod & (1 << bit)]
    info = {
        "Device Name": dev.name or "<unknown>",
        "MAC Address": address.upper(),
        "Device Type": f"Classic Bluetooth (BR/EDR) - {device_class(cod)} "
                       f"(Class of Device 0x{cod:06X})",
        "Service classes": ", ".join(services_cls) or "-",
        "Paired": "yes" if dev.device_information.pairing.is_paired else "no",
        "Connection": str(dev.connection_status).split(".")[-1].title(),
    }

    result = await dev.get_rfcomm_services_with_cache_mode_async(BluetoothCacheMode.UNCACHED)
    services = []
    for svc in result.services:
        svc_uuid = str(svc.service_id.uuid).lower()
        entry = {"uuid": svc_uuid,
                 "name": SERVICE_NAMES.get(short_uuid(svc_uuid) or -1, "Custom / vendor service"),
                 "protocol": "L2CAP -> RFCOMM", "profile": ""}
        try:
            attrs = await svc.get_sdp_raw_attributes_with_cache_mode_async(
                BluetoothCacheMode.UNCACHED)
            for attr_id, buf in map_items(attrs):
                value, _ = sdp_parse(buffer_to_bytes(buf))
                if attr_id == ATTR_SERVICE_NAME and value:
                    entry["name"] = f"{value}  [{entry['name']}]"
                elif attr_id == ATTR_PROTOCOL_LIST:
                    entry["protocol"] = describe_protocols(value) or entry["protocol"]
                elif attr_id == ATTR_PROFILE_LIST and value:
                    profiles = []
                    for p in value:
                        pid = p[0] if isinstance(p[0], int) else short_uuid(p[0])
                        ver = p[1] if len(p) > 1 else 0
                        profiles.append(f"{SERVICE_NAMES.get(pid, hex(pid or 0))} "
                                        f"v{ver >> 8}.{ver & 0xFF}")
                    entry["profile"] = ", ".join(profiles)
        except Exception as e:                  # SDP read can be refused if unpaired
            entry["profile"] = f"(SDP attributes unavailable: {e})"
        services.append(entry)

    if not services:
        info["Note"] = ("No RFCOMM services returned "
                        f"({str(result.error).split('.')[-1]}). Pair the device first "
                        "and keep it awake / unlocked.")
    return info, services


def classic_info_pybluez(address):
    import bluetooth
    info = {"Device Name": bluetooth.lookup_name(address) or "<unknown>",
            "MAC Address": address.upper(), "Device Type": "Classic Bluetooth (BR/EDR)"}
    services = []
    for s in bluetooth.find_service(address=address):
        sid = (s.get("service-classes") or ["?"])[0]
        proto = s.get("protocol") or "?"
        if s.get("port"):
            proto += f" (channel/PSM {s['port']})"
        services.append({"uuid": sid, "name": s.get("name") or "?",
                         "protocol": "L2CAP -> " + proto if proto != "L2CAP" else proto,
                         "profile": ", ".join(f"{p[0]} v{p[1]}" for p in s.get("profiles", []))})
    return info, services


async def classic_info(address):
    if platform.system() == "Windows":
        return await classic_info_windows(address)
    return await asyncio.to_thread(classic_info_pybluez, address)


# ---------------------------------------------------------------------------
# Bluetooth Low Energy (bleak: GATT services)
# ---------------------------------------------------------------------------
async def ble_info(address):
    from bleak import BleakClient

    async with BleakClient(address, timeout=20) as client:
        info = {"Device Name": getattr(client, "name", None) or "<unknown>",
                "MAC Address": address.upper(),
                "Device Type": "Bluetooth Low Energy"}
        for s in client.services:
            for c in s.characteristics:
                sid = short_uuid(c.uuid)
                if sid in (0x2A00, 0x2A01) and "read" in c.properties:
                    try:
                        data = await client.read_gatt_char(c)
                    except Exception:
                        continue
                    if sid == 0x2A00:
                        info["Device Name"] = data.decode("utf-8", "replace")
                    elif len(data) >= 2:
                        app = int.from_bytes(data[:2], "little")
                        info["Device Type"] += (f" - {APPEARANCE.get(app >> 6, 'Other')} "
                                                f"(Appearance 0x{app:04X})")

        services = []
        for s in client.services:
            chars = [f"{c.description or 'Unknown'} [{c.uuid}] ({', '.join(c.properties)})"
                     for c in s.characteristics]
            services.append({"uuid": s.uuid, "name": s.description or "Custom / vendor service",
                             "protocol": "L2CAP (CID 0x0004) -> ATT -> GATT",
                             "profile": "", "characteristics": chars})
    return info, services


# ---------------------------------------------------------------------------
def print_info(info, services):
    print("\n" + "=" * 78)
    print(" BLUETOOTH DEVICE INFORMATION")
    print("=" * 78)
    for k, v in info.items():
        print(f"  {k:<16}: {v}")
    print(f"\n  Available services: {len(services)}")
    for i, s in enumerate(services, 1):
        print(f"\n  [{i}] Service Name : {s['name']}")
        print(f"      Service UUID : {s['uuid']}")
        print(f"      Protocol     : {s['protocol']}")
        if s.get("profile"):
            print(f"      Profile      : {s['profile']}")
        for c in s.get("characteristics", []):
            print(f"        - {c}")


async def run(args):
    address, ble = args.address, args.ble
    if not address:
        devices = await discover_all(args.timeout)
        print_devices(devices)
        if not devices:
            return
        while True:
            choice = input("\nSelect a device number: ").strip()
            if choice.isdigit() and 1 <= int(choice) <= len(devices):
                break
            print("Invalid choice.")
        dev = devices[int(choice) - 1]
        address, ble = dev["address"], dev["kind"] == "BLE"

    print(f"\nQuerying {address} ({'BLE / GATT' if ble else 'Classic / SDP'}) ...")
    info, services = await (ble_info(address) if ble else classic_info(address))
    print_info(info, services)


def main():
    ap = argparse.ArgumentParser(description="Detailed info for a Bluetooth device")
    ap.add_argument("address", nargs="?", help="device MAC (omit to scan and choose)")
    ap.add_argument("--ble", action="store_true", help="device is Bluetooth Low Energy")
    ap.add_argument("--timeout", type=float, default=10, help="scan time in seconds")
    args = ap.parse_args()
    try:
        asyncio.run(run(args))
    except Exception as e:
        print(f"\n[!] {e}")


if __name__ == "__main__":
    main()
