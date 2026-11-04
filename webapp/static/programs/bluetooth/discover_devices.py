"""
Bluetooth Device Discovery
==========================
Discovers nearby Bluetooth devices and displays their MAC address and name.

  * Classic Bluetooth (BR/EDR) - phones, laptops, headsets, speakers ...
      Windows: WinRT DeviceWatcher (same engine as Settings > Bluetooth)
      Linux  : PyBluez  (pip install pybluez)
  * Bluetooth Low Energy (BLE)  - watches, fitness bands, sensors, beacons ...
      bleak (Windows / Linux / macOS)

Usage:
  python discover_devices.py              # classic + BLE, 10 s each
  python discover_devices.py --timeout 20
  python discover_devices.py --ble        # BLE only
  python discover_devices.py --classic    # Classic only

Requires: pip install -r requirements.txt
Make sure Bluetooth is ON and the other device is discoverable / visible.
"""

import argparse
import asyncio
import platform
import threading

MAJOR_CLASSES = {0: "Miscellaneous", 1: "Computer", 2: "Phone",
                 3: "Network Access Point", 4: "Audio/Video", 5: "Peripheral",
                 6: "Imaging", 7: "Wearable", 8: "Toy", 9: "Health",
                 31: "Uncategorized"}


def format_mac(value: int) -> str:
    return ":".join(f"{(value >> s) & 0xFF:02X}" for s in range(40, -1, -8))


def device_class(cod: int) -> str:
    """Major device class from the 24-bit Class of Device field."""
    return MAJOR_CLASSES.get((cod >> 8) & 0x1F, "Unknown")


# ---------------------------------------------------------------------------
# Classic Bluetooth
# ---------------------------------------------------------------------------
async def discover_classic_windows(timeout):
    from winrt.windows.devices.bluetooth import BluetoothAdapter, BluetoothDevice
    from winrt.windows.devices.enumeration import DeviceInformation

    if await BluetoothAdapter.get_default_async() is None:
        raise RuntimeError("No Bluetooth adapter found (is Bluetooth turned on?)")

    found, lock = {}, threading.Lock()

    def on_added(_watcher, info):             # called from a WinRT thread
        with lock:
            found[info.id] = info.name

    watchers = []
    for paired in (True, False):              # paired devices + inquiry scan
        w = DeviceInformation.create_watcher_aqs_filter(
            BluetoothDevice.get_device_selector_from_pairing_state(paired))
        w.add_added(on_added)
        w.add_updated(lambda *_: None)        # required for 'added' to keep firing
        w.start()
        watchers.append(w)
    await asyncio.sleep(timeout)
    for w in watchers:
        w.stop()

    devices = []
    for dev_id, name in found.items():
        dev = await BluetoothDevice.from_id_async(dev_id)
        if dev is None:
            continue
        devices.append({
            "address": format_mac(dev.bluetooth_address),
            "name": dev.name or name or "<unknown>",
            "kind": "Classic",
            "type": device_class(dev.class_of_device.raw_value),
            "paired": dev.device_information.pairing.is_paired,
            "rssi": None,
        })
    return devices


def discover_classic_pybluez(timeout):
    import bluetooth                          # PyBluez
    found = bluetooth.discover_devices(duration=max(1, int(timeout / 1.28)),
                                       lookup_names=True, lookup_class=True)
    return [{"address": addr, "name": name or "<unknown>", "kind": "Classic",
             "type": device_class(cod), "paired": None, "rssi": None}
            for addr, name, cod in found]


async def discover_classic(timeout):
    if platform.system() == "Windows":
        return await discover_classic_windows(timeout)
    return await asyncio.to_thread(discover_classic_pybluez, timeout)


# ---------------------------------------------------------------------------
# Bluetooth Low Energy
# ---------------------------------------------------------------------------
async def discover_ble(timeout):
    from bleak import BleakScanner
    found = await BleakScanner.discover(timeout=timeout, return_adv=True)
    return [{"address": dev.address, "name": adv.local_name or dev.name or "<unknown>",
             "kind": "BLE", "type": "Low Energy", "paired": None, "rssi": adv.rssi}
            for dev, adv in found.values()]


# ---------------------------------------------------------------------------
async def discover_all(timeout, classic=True, ble=True):
    """Run the requested scans and return one merged, de-duplicated list."""
    devices = []
    if classic:
        print(f"Scanning for Classic Bluetooth devices ({timeout}s) ...")
        try:
            devices += await discover_classic(timeout)
        except Exception as e:
            print(f"  [!] Classic scan failed: {e}")
    if ble:
        print(f"Scanning for Bluetooth Low Energy devices ({timeout}s) ...")
        try:
            devices += await discover_ble(timeout)
        except Exception as e:
            print(f"  [!] BLE scan failed: {e}")
    seen, unique = set(), []
    for d in devices:
        key = (d["address"].upper(), d["kind"])
        if key not in seen:
            seen.add(key)
            unique.append(d)
    return unique


def print_devices(devices):
    print(f"\n=== {len(devices)} Bluetooth device(s) found ===")
    if not devices:
        print("None. Check Bluetooth is on and the other device is discoverable.")
        return
    print(f"{'#':>2}  {'MAC Address':<19} {'Name':<28} {'Kind':<8} {'Type':<14} {'RSSI':>5}  Paired")
    print("-" * 90)
    for i, d in enumerate(devices, 1):
        rssi = f"{d['rssi']}" if d["rssi"] is not None else "-"
        paired = {True: "yes", False: "no", None: "-"}[d["paired"]]
        print(f"{i:>2}  {d['address']:<19} {d['name'][:28]:<28} {d['kind']:<8} "
              f"{d['type']:<14} {rssi:>5}  {paired}")


def main():
    ap = argparse.ArgumentParser(description="Discover nearby Bluetooth devices")
    ap.add_argument("--timeout", type=float, default=10, help="seconds per scan")
    grp = ap.add_mutually_exclusive_group()
    grp.add_argument("--classic", action="store_true", help="Classic Bluetooth only")
    grp.add_argument("--ble", action="store_true", help="Bluetooth Low Energy only")
    args = ap.parse_args()

    devices = asyncio.run(discover_all(args.timeout,
                                       classic=not args.ble, ble=not args.classic))
    print_devices(devices)


if __name__ == "__main__":
    main()
