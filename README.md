# Tariff Lab: which UK smart tariff suits a solar + battery home?

An interactive, **fully static** snapshot of one household's last 12 months of real solar, usage and battery data,
replayed through every compatible Octopus Energy import/export tariff pairing with a realistic home-battery controller.
It ranks them, shows month and day detail, the battery's losses, and how much of the profit really comes from
grid-to-battery arbitrage after round-trip losses.

**Live site: https://anchorapp100.github.io/tariff-lab/**

No server, no sign-in, no API keys and no tracking: the page only reads its own files (its Content-Security-Policy
blocks every other network request). Pages download on demand; the whole site is about 24 MB.

## What you are looking at
* **One household, not yours.** A solar array that generated 11,515 kWh over the year, a 32 kWh
  (nominal) battery, in the West Midlands Octopus region. The results will differ for a different home, tariff region or battery. Treat it as a worked
  case study of *how* to compare tariffs, not as a recommendation for you.
* **26 import/export pairings**, each simulated over 365 days, under two controllers:
  *realistic* (forecast-driven, re-plans every two hours, only knows prices Octopus had published at the time) and
  *perfect foresight* (an upper bound).
* **Savings ladder:** tariff effect, then solar, then battery, against a flat-rate 24/7 tariff with no solar or battery.
  A toggle removes standing charges so tariffs with different daily charges compare fairly.
* **Arbitrage tab:** energy bought, where it went (house, export, losses), what it cost and earned, and the net profit.

### Headline, realistic controller, including standing charges
Net annual bill (a negative number means the household is paid more than it spends):

| Import tariff | Export tariff | Net annual bill | Imported kWh | Exported kWh |
|---|---|---:|---:|---:|
| Octopus Go 12M Fixed (the household's current contract) | Outgoing Octopus | -£1,015 | 10,831 | 14,260 |
| Octopus Flux | Octopus Flux Export | -£974 | 4,100 | 8,820 |
| Octopus Go (variable) | Agile Outgoing Octopus | -£914 | 7,704 | 11,600 |
| Octopus Go 12M Fixed (renewal) | Agile Outgoing Octopus | -£811 | 6,239 | 10,404 |
| Agile Octopus | Agile Outgoing Octopus | -£679 | 3,013 | 7,853 |

*Model estimates. Past rates and one year of weather are not a forecast, and tariffs change.*

## Use it
Open the page. Pick a tariff pairing and controller at the top, then browse the tabs. Everything is pre-calculated,
so there is nothing to install.

## Disclaimers
* **Unofficial and independent.** Not affiliated with, endorsed by or sponsored by Octopus Energy. "Octopus" and the
  tariff names belong to their owners and are used only to say which public tariffs were compared.
* **Not financial or energy advice.** Figures are model estimates for one household. Check a tariff's current terms
  before switching.
* **Personal details removed.** The data is one household's half-hourly solar, usage and battery figures; the owner's
  address, account, meter and device identifiers are not included.

## Credits and licences
* Tariff rates: [Octopus Energy public API](https://developer.octopus.energy/rest/).
* Weather forecasts and history: [Open-Meteo.com](https://open-meteo.com/), licensed
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
* Charts: [Apache ECharts](https://echarts.apache.org/), Apache-2.0 (licence in `docs/vendor/echarts.LICENSE`).
* This project: all rights reserved unless a licence file says otherwise.
