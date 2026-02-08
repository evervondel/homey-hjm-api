# homey-hjm-api (Homey App)

<img src="assets/icon.svg" alt="Thermostat Icon" width="64" height="64" />

Homey app (Apps SDK v2) for HJM SmartBox thermostats using REST API.

## Manual-only setpoint

Setting `target_temperature` is only allowed when `thermostat_mode` is `manual`.

## Flows

Device action Flow cards included:

- **Refresh thermostat now**: refreshes status from the API.
- **Set thermostat mode**: sets mode to `off`, `auto` or `manual`.
- **Set target temperature**: sets the setpoint (manual mode only).

## Polling (optional)

By default, this app does **no periodic polling**.

The device refreshes:

1. Once on init
2. After any user change (mode or setpoint)
3. On demand (Flow cards or `button.refresh`)

You can enable periodic polling per device via device settings:

- **Enable polling:** toggle polling on/off (default: disabled).
- **Polling interval:** set interval in seconds (default: 30s, minimum: 20s).

When enabled, the device refreshes at the configured interval. Polling stops immediately when toggled off or when the device is deleted/uninitialized.

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

## Changes (recent)

- **REST debug logging:** The client now supports detailed request/response logging (auth tokens are masked). Enable via the app setting `debugRest` in the app settings UI. Logs appear in the Homey app log.

- **SDK v2 compliance:** Capability listeners return a boolean result as expected by the SDK, and device lifecycle events (`uninit`/`deleted`) are handled to ensure polling timers are cleaned up.
