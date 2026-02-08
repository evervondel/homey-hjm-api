# homey-hjm-api (Homey App)

Homey app (Apps SDK v3) for HJM SmartBox thermostats using REST only (on-demand refresh, no polling).

## Manual-only setpoint

Setting `target_temperature` is only allowed when `thermostat_mode` is `manual`.

## Flows

Device action Flow cards included:

- **Refresh thermostat now**: refreshes status from the API.
- **Set thermostat mode**: sets mode to `off`, `auto` or `manual`.
- **Set target temperature**: sets the setpoint (manual mode only).

## No polling

This version does **no periodic polling**.

The device refreshes:

1. Once on init
2. After any user change (mode or setpoint)
3. On demand (Flow cards or `button.refresh`)

## Setup

```bash
npm install -g homey
cd homey-hjm-api
npm install
homey login
homey app run
```

## Configure credentials

Homey App > Apps > HJM API > Configure App:

- Client ID
- Client Secret
- User e-mail
- Password

## Add a device

Devices > + > HJM Thermostat

The list is populated from `GET /api/v2/grouped_devs`.
