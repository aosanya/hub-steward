# Load the demo agencies

Each folder in [demo](../../../demo) holds an `agency.json` template for one synthetic agency: `agricultural-drone-crop-spraying-service`, `boda-boda-riders`, `clinical-research-organization`, `electric-grid-utility`, `farmers`, `logistics-freight-company`, `mobile-money-operator` and `siaya-lab`, and the single file `demo/municipality.json`. The console's Create Hub page imports one; to do it by hand, sign in and post it to the API. The example below imports the Siaya lab; change the folder and the name for any other.

```sh
curl -c jar -X POST localhost:8082/auth/signin -H 'content-type: application/json' \
  -d '{"email":"you@example.org","password":"..."}'

python3 -c "import json;d=json.load(open('demo/siaya-lab/agency.json'));d['name']='Siaya lab';print(json.dumps(d))" |
  curl -b jar -X POST localhost:8082/instances/import -H 'content-type: application/json' -d @-
```

It answers `201` with the new instance and the count of roles, goals, workflows and controls created. The caller becomes the agency's owner.

A fresh API has no sign-in. Start it with `WAKALA_ADMIN_TOKEN` set, then create one with `POST /auth/credentials` and the header `X-Admin-Token`.

Only the Siaya lab's import has a recorded result: no errors, no issues ([Results](../../4.%20qa/testing/02-results/README.md)). The other eight are not recorded, and the console's Create Hub stops at connecting Hub Steward for the five that have no role that may use AI (freight, drone spraying, clinical research, grid utility, mobile money). The copies in `code/console/public/templates/` are identical to the files in `demo/`.
