"""
Bundle the lab programs into the web app so it works without the lab server
(e.g. when deployed to Vercel as a static site).

  python webapp/bundle.py

Run it again after changing any lab program. It writes webapp/static/programs/:
  manifest.json            lab id -> program files / program run by "Run Program"
  <program paths>          copies of the .py files (Source Code tab, downloads, Pyodide)
  recorded/beacon.json     recorded output of beacon_analyzer.py on the sample capture
"""

import json
import os
import shutil

from server import LABS, STATIC, WCN, run_program

OUT = os.path.join(STATIC, "programs")
EXTRA = ["beacon_analyzer/sample_beacons.pcap", "bluetooth/requirements.txt"]


def copy(rel):
    dst = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copyfile(os.path.join(WCN, rel), dst)


def main():
    shutil.rmtree(OUT, ignore_errors=True)
    manifest = {}
    for lab, (files, script, args) in LABS.items():
        for rel in files:
            copy(rel)
        manifest[lab] = {"files": files, "run": script,
                         "args": [os.path.relpath(a, WCN).replace("\\", "/") if os.path.isabs(a) else a
                                  for a in args]}
    for rel in EXTRA:
        copy(rel)

    os.makedirs(os.path.join(OUT, "recorded"), exist_ok=True)
    rec = run_program("beacon")
    rec["recorded"] = True
    with open(os.path.join(OUT, "recorded", "beacon.json"), "w", encoding="utf-8") as f:
        json.dump(rec, f)

    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=1)
    print(f"Bundled {len(manifest)} labs into {os.path.relpath(OUT, WCN)}")


if __name__ == "__main__":
    main()
