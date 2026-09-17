# Passenger, baggage and BSM estimation study

Research date: 17 September 2026. Status: mathematical study and implementation plan only. No calculator has been built.

## 1. Recommendation

Use a transparent, segmented expectation model:

**Passengers -> passengers within the selected BRS scope -> checked bags -> BSM messages received at that BRS.**

The core formula is:

`Expected BSM messages = sum over segments (eligible PAX × bags per PAX × received BSM messages per bag)`

Bag quantity and message quantity are different outputs. There is no universal BSM-per-passenger constant established by the public sources reviewed. Local airline mix, baggage behaviour, message grouping, message updates and system routing determine the coefficients.

The user requested that annual airport PAX, annual departing PAX and PAX per flight can each be selected individually or displayed together as separate scenarios. These are alternative input bases, not additive traffic categories.

## 2. Research findings and evidence

| Finding | Evidence | Implication |
|---|---|---|
| Passenger-based baggage estimation is an established planning method. | ACRP Report 25, Volume 2, baggage screening model, printed pages 44–45: inputs include passengers checking in, share checking bags and bags per passenger; its example is 1,500 × 60% × 1.5 = 1,350 bags. [ACRP guide](https://crp.trb.org/acrp0715/wp-content/themes/acrp-child/documents/031/original/ACRP_25_Airport_Passenger_Terminal_Planning_and_Design_Volume_2.pdf) | Separate participation in checking bags from the conditional number of bags. The example is instructional, not a current global average. |
| Bag rates vary by passenger flow. | SFO's September 2016 draft-final baggage study, Table G.2-1, printed page 16, uses 2014 United Airlines data: originating domestic 0.80, transfer domestic 0.86, originating international 1.01, transfer international 1.07 bags/PAX. The study considers these maximum values for its planning. [SFO study](https://planning.flysfo.com/wp-content/uploads/2023/04/Appendix_G_BHS.pdf) | These historical, airport-specific values support segmentation; they are not universal defaults or present-day forecasts. |
| A BSM can contain information about multiple bags, including sequential tags. | SITA Bag Manager documentation describes bag groups, local/transfer/terminating indicators and messages sent to origin and transfer stations. [SITA documentation](https://azlad2.sitabagmanager.com/bagmanager-help/BMHelp/Content/Bag%20Manager%20V7/Baggage%20Information%20Message%20%28BIM%29.htm) | One bag does not necessarily mean one received BSM envelope. Count at the chosen interface. |
| NEW, CHG and DEL represent different message actions. | IATA's published change-indicator codelist. [IATA data model](https://airtechzone.iata.org/aidm_model/24.1/EARoot/EA6/EA2/EA5/EA8/EA2/EA16962.htm) | Changes and deletions add message processing without necessarily adding physical bags. |
| Tracking points and message types are different concepts. | Resolution 753 implementation guide, section 6, identifies acceptance, loading, transfer and arrival tracking, and lists distinct baggage message types. [IATA guide, issue 4.0, 2023](https://www.iata.org/contentassets/d22bcfe86aa54f22a2919b0e4224f68f/reso753-implementation-guide---2023_issue-4.0.pdf) | Four tracking points do not establish four BSMs per bag. |
| RP 1745 is the relevant legacy baggage information messaging reference. | IATA's baggage standards directory lists RP 1745, RP 1745a and RP 1746. [IATA standards](https://www.iata.org/en/programs/ops-infra/baggage/standards/) | Validate integration details against the applicable licensed standard and actual airline/BRS interface specifications during implementation. |

The formulas below are a proposed estimation model derived from these principles. They are not an IATA-prescribed capacity formula. The study does not assert conformance to the complete, current RP 1745 text.

## 3. Define the counting boundary

Default boundary: one airport's selected BRS, incoming BSM envelopes before duplicate suppression, covering departing baggage. Other message types and outbound deliveries are separate workloads.

Maintain these distinct quantities:

- **Bag count:** checked-baggage items accepted or acquired for the selected airport handling visit; include applicable gate-checked items. Exclude ordinary cabin baggage.
- **Distinct BSM messages:** initial and subsequent NEW/CHG/DEL messages, excluding transport redeliveries of the same message.
- **Received BSM messages:** all BSM envelope deliveries reaching the defined BRS boundary, including duplicates and retries.
- **Bag-level message references:** individual bag references after expanding a grouped message. This is an optional parser-workload metric, not another name for envelope count.

Do not interpret the number of database records currently retained as the number of received messages. Do not interpret final loaded bags as all baggage initially accepted: offloaded/cancelled items can already have caused messages.

Copies sent to other airports or systems do not count toward this BRS's inbound total unless they actually arrive at this boundary. A service processing a whole network needs station-level inputs and a defined network counting boundary.

## 4. Passenger input modes

Let `P` denote the slider value and `D` the departing PAX represented by it, for the chosen period.

| Mode | Conversion | Required interpretation |
|---|---|---|
| Annual airport PAX, arrivals + departures | `D = P × a` | `a` is departing PAX divided by the reported total. A provisional 0.50 assumes balanced arrivals/departures and a compatible reporting definition. Prefer actual totals. |
| Annual departing PAX | `D = P` | Departing PAX include transfer passengers boarding outgoing flights. Do not add those passengers again. |
| PAX per departing flight | `D = P` | P is actual/expected passengers, not seats. |
| Optional seats-per-flight input | `D = seats × load factor` | Apply load factor only when starting from seats. |

No universal conversion exists from one flight to annual traffic without flight frequency and operating days. Likewise, annual totals do not determine peak message rates on their own.

An optional daily/hourly mode can use the same formula when its passenger period is explicitly defined. A flight's messages can arrive hours before departure, so flight departure-hour passengers are not automatically message-arrival-hour demand.

When several modes are displayed, each retains its own input and period labels. Do not sum an airport's annual total, its departing subtotal and its individual flights.

## 5. Passenger-to-bag mathematics

### 5.1 Simple model

Define:

- `c`: fraction of departing PAX served by this BRS, from 0 to 1. This represents contracted/operational scope, not message loss.
- `b`: mean checked bags per served departing passenger, including passengers with zero bags.

Then:

`B = D × c × b`

If the selected PAX already refer only to served traffic, set `c = 1`.

### 5.2 Explainable baggage behaviour

Let `q` be the fraction of PAX with at least one checked bag, and `mu` the average number of checked bags among those passengers. Then:

`b = q × mu`

`B = D × c × q × mu`

This follows from the expectation of a bag-count variable `X`: `E[X] = Pr(X > 0) × E[X | X > 0]`. It does not require independence between bag participation and bag quantity.

Example: `q = 0.75`, `mu = 1.20`, so `b = 0.90`.

If `b` is entered directly, do not multiply it by `q` again. An optional gate-bag increment `g` gives `b = q × mu + g` only if q and mu explicitly exclude gate-checked baggage. Otherwise g must be zero. Apply the same no-double-counting rule to strollers, sports equipment and other tagged items.

### 5.3 Segmented model

Partition departing PAX into mutually exclusive segments `s`: originating domestic, originating international, transfer domestic and transfer international. Domestic/international means the outgoing leg's classification for this model. More granular airline or seasonal segments can be added later.

`D_s = D × w_s`, where `sum(w_s) = 1`.

`B_s = D_s × c_s × b_s`

`B_departure = sum(B_s)`

Where detailed traffic is unavailable, an optional transfer share `t` gives `D_originating = D × (1 - t)` and `D_transfer = D × t`; domestic/international shares can then be set separately inside each group.

An airport-wide passenger share and a BRS-served passenger share may have different airline mixes. Segment first when service coverage is selective.

## 6. Bag-to-BSM mathematics

### 6.1 Recommended calculator formula

Let `m_s` be the average number of received BSM envelopes per in-scope bag in segment s, measured at the selected BRS boundary.

`M_received = sum(B_s × m_s) + M_extra`

`M_extra` is an optional separately measured allowance for messages outside the modeled bag cohort, such as records for bags never physically presented or off-scope messages delivered to the interface. Default zero is a declared simplifying assumption, not proof that such traffic is absent.

For one homogeneous segment and zero extra traffic:

**`M_received = P × a × c × b × m`** for annual airport-total mode.

**`M_received = P × c × b × m`** for departing-PAX or flight mode.

All coefficients must refer to the same scope and compatible periods. With fixed coefficients, volume is linear in PAX. Holding traffic mix fixed is a scenario assumption; a material mix change requires different coefficients.

### 6.2 Optional decomposition of m

For a fully covered bag cohort, define:

- `k`: mean bags represented per initial distinct BSM envelope, counting each bag once in the initial population.
- `u`: additional distinct CHG envelopes per modeled bag.
- `v`: distinct DEL envelopes per modeled bag.
- `r`: additional distinct NEW/reissue envelopes per modeled bag, beyond the initial population.
- `d`: extra repeat deliveries divided by distinct envelopes, e.g. 0.04 means four additional deliveries per 100 distinct messages.

Then:

`M_distinct = B × (1/k + u + v + r)`

`M_received = M_distinct × (1 + d)`

`m = (1/k + u + v + r) × (1 + d)`

u, v and r are envelope counts per bag, not percentages of affected passengers. If 10% of bags each trigger two extra envelopes, that component equals 0.20 envelopes/bag. Grouped updates must be counted as envelopes, not expanded bag references.

If a duplicate statistic is instead expressed as the fraction of all received messages that are duplicates (`delta`), use `M_received = M_distinct / (1 - delta)`. These two duplicate definitions are not interchangeable.

The decomposition assumes initial coverage for all modeled bags. With incomplete feeds or ambiguous grouping, use a directly measured m and investigate coverage separately. Missing messages must not become an unexamined way to reduce provisioned demand.

An m below 1 is possible when initial BSMs group bags and subsequent message traffic is small. Therefore the tool must not impose a minimum of one message per bag.

## 7. Worked example and sensitivity

The following is an illustrative scenario, not an industry benchmark:

`P_departing = 1,000,000/year; c = 1; q = 0.75; mu = 1.20; b = 0.90`

`k = 1; u = 0.20; v = 0.02; r = 0.03; d = 0.04; M_extra = 0`

Thus `B = 900,000` bags/year and `m = (1 + 0.20 + 0.02 + 0.03) × 1.04 = 1.30`.

| Component | Annual envelopes |
|---|---:|
| Initial NEW | 900,000 |
| CHG | 180,000 |
| DEL | 18,000 |
| Additional NEW/reissue | 27,000 |
| Distinct messages | 1,125,000 |
| Repeat deliveries | 45,000 |
| Total received BSM messages | **1,170,000** |

The equivalent airport-total input is 2,000,000 annual PAX if a = 0.50. A flight with 180 passengers and the same bag/message profile gives 162 expected bags and 210.6 expected received BSMs, displayed as approximately 211. Fractional expectations are valid; rounding should occur only for display.

Illustrative sensitivity cases per 1,000,000 served departing PAX:

| Scenario | Bags/PAX b | Received BSM/bag m | Expected bags | Received BSM |
|---|---:|---:|---:|---:|
| Low | 0.60 | 1.05 | 600,000 | 630,000 |
| Base | 0.90 | 1.30 | 900,000 | 1,170,000 |
| High | 1.20 | 1.80 | 1,200,000 | 2,160,000 |

These values are deliberately adjustable assumptions, not measured market averages, probability bounds or guaranteed worst cases. Historical SFO rates may be offered separately as a clearly dated reference profile, never mixed invisibly with these illustrative scenarios.

For fixed a, c and other inputs, `dM/dP = a × c × b × m` in airport-total mode. A 10% rise in PAX alone raises M by 10%. Raising b and m each by 10% raises M by 21%, since their effects multiply.

## 8. Arrival scope, transfers and other BRS traffic

For an optional arrival-processing service, add a separately defined message stream:

`M_all = M_departure + B_terminating × m_terminating + M_other_inbound_streams`

Include a stream only when the interface actually receives it, and ensure that each received envelope belongs to one stream. Use terminating PAX for final-destination arrivals. Do not treat all arriving passengers as terminating passengers: some connect onward.

A connecting bag may have both inbound and outbound handling events. It can contribute to several workload counters without becoming two unique physical bags in a whole-airport visit count. Unique-bag totals across overlapping streams require deduplication; the calculator should otherwise label them as bag movements.

BSM estimates exclude BPM, BTM, BUM, BCM, scanner transactions, acknowledgements and outbound copies. If total BRS transaction capacity is later required, model each of those separately before combining workloads. Resolution 753 tracking points are not a BSM multiplier.

## 9. Throughput and peak capacity

Annual volume supports budget estimates but does not establish peak capacity.

For initial scenario analysis:

`M_average_day = M_year / operating_days`

`M_design_day = M_average_day × F_day`

`M_peak_hour = M_design_day × h`

`lambda_peak = (M_peak_hour / 3600) × F_burst`

Here F_day is the selected busy-day/average-day ratio, h is the share of that day's incoming messages arriving in its busiest hour, and F_burst describes shorter bursts relative to the peak-hour average. These must come from message timings or explicit assumptions, not physical conveyor screening factors.

For an outage recovery backlog of Q envelopes drained over T seconds:

`C_design = (lambda_peak + Q/T) × (1 + H)`

H is a chosen capacity headroom fraction. This is a planning target; actual sustained performance needs benchmarking with realistic payload sizes, grouping, database work and concurrency. Headroom affects provisioned capacity, not predicted annual message counts.

Prefer actual rolling 1-second, 1-minute and 5-minute message counts when available. A later schedule-based model can use `lambda(t) = sum_f(M_f × h_f(t))`, where each flight's message-time density integrates to one. Use distinct timing profiles for early source messages, transfer messages, changes and reconnect/replay traffic.

## 10. Calibration and uncertainty

Request at least several representative weeks spanning busy and quiet operations; 8–12 weeks is a practical proposed starting window. Include seasonal peaks and disruption samples where available. A full year better reveals seasonality.

Use aligned passenger, bag and message data with the same airport, airline, flight date, direction and service scope. Capture arrival timestamp, message type/action, source, destination, tag references and a stable message identity or canonical payload hash. Passenger names are unnecessary for the volume model.

Recommended estimates:

`b_s = sum(actual in-scope bags_s) / sum(served departing PAX_s)`

`m_s = sum(received cohort BSM envelopes_s) / sum(actual in-scope bags_s)`

Use ratios of totals, not an unweighted average of flight ratios. Count distinct bag visits using tag plus relevant journey/flight/date/station context; tags alone can be reused. Map retags when estimating physical items. Deduplicate repeated messages by identity/content and operational context; preserve legitimate later changes to the same bag.

Allow pre-departure and late-arriving messages to join their flight cohort when calibrating m. Separately retain receipt-time totals for infrastructure sizing. Avoid losing messages simply because they cross midnight or year boundaries.

Hold out later flights/days for validation. Compare predicted vs actual bags, distinct BSMs and received BSMs by airline, segment and peak period. Report aggregate bias and weighted absolute percentage error: `WAPE = sum(abs(predicted - actual)) / sum(actual)`, when the denominator is positive. Set accuracy targets after inspecting data quality and intended business use.

Until calibrated, show low/base/high **scenarios**, not a 95% confidence interval. With data, bootstrap whole flight-days or operational blocks within relevant seasons to retain correlated disruption effects. Quantile predictions and empirical peak replay are later extensions; a Poisson assumption should not be imposed on clustered DCS traffic.

## 11. Plan for the subsequent tool build

1. Build a deterministic calculation layer implementing the simple and segmented equations, with explicit units and counting scopes.
2. Provide selectable annual-airport, annual-departure and flight modes, individually or side by side. Give each mode its own slider plus exact numeric entry. Keep unrelated periods separate.
3. Expose bags/PAX and received BSM/bag as the primary assumptions. Add advanced controls for baggage participation, conditional bag count, traffic mix, BRS coverage, grouping, changes, deletions and repeated delivery.
4. Offer mutually exclusive direct-coefficient and decomposed-coefficient input methods. Always show the effective b and m. Do not apply the two methods cumulatively.
5. Display expected bags and received BSM messages as the main results. Include optional distinct messages, message components and peak-capacity assumptions when supported by the selected inputs.
6. Show a PAX-versus-message curve with separate low/base/high scenarios and explain that a straight line follows from fixed inputs. Add source/date/assumption labels to every preset.
7. Allow scenario save/export with period, PAX basis, scope, parameter values, formula version and source provenance. Historical references and calibrated local profiles must be distinguishable.
8. Validate arithmetic, unit conversion, grouping, rounding and scope before adding optional calibration imports or peak-timing features.

Proposed acceptance cases:

- Zero PAX produces zero passenger-driven bags/messages when M_extra is zero.
- Doubling PAX doubles bags and messages with fixed coefficients.
- 2,000,000 airport PAX at a = 0.50 matches 1,000,000 departing PAX under identical assumptions.
- q = 0.75 and mu = 1.20 match direct b = 0.90.
- For B = 100, k = 2 and no extra messages, there are 50 distinct/received envelopes while the bag count stays 100.
- The worked example produces 900,000 bags and 1,170,000 received BSMs.
- Transfer shares partition departing PAX without adding a second copy of connecting passengers.
- Segment shares sum to one; probabilities and shares remain within 0–1; counts/rates remain nonnegative; conditional mu is at least one when q is positive; k is at least one for the defined initial population.
- Missing peak parameters show peak throughput as undetermined, not inferred from annual totals alone.
- No summed grand total appears for overlapping comparison modes; intermediate values remain unrounded.

## 12. Handoff and stopping point

The recommended first release is a transparent scenario calculator, not a trained prediction model. It can be built from the equations and acceptance cases above once the user changes models and requests implementation.

Unresolved local inputs are airport/airline mix, traffic counting convention, BRS coverage, actual bag rates, BSM grouping/update behaviour and peak timing. The proposed tool can expose these as editable assumptions until measured data replace them.

Research and mathematical planning end here. No application code, interactive prototype, server or deployment is part of this deliverable.
