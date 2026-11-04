import subprocess

AUTH = {"Open": "Open System", "Shared": "Shared Key", "Personal": "PSK", "Enterprise": "802.1X/EAP"}
out = subprocess.run("netsh wlan show networks mode=bssid", capture_output=True, text=True).stdout

for line in out.splitlines():
    k, _, v = (x.strip() for x in line.partition(":"))
    if k.startswith("SSID"):
        print("\na. SSID           :", v or "<hidden>")
    elif k == "Authentication":
        print("b. Security Type  :", "WEP" if v == "Shared" else v.split("-")[0])
        print("c. Authentication :", "SAE" if v == "WPA3-Personal" else AUTH.get(v.split("-")[-1], v))
    elif k == "Encryption":
        print("d. Encryption     :", v)
    elif k == "Channel":
        print("e. Channel        :", v)
