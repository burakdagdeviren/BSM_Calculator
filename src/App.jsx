import { useMemo, useState } from 'react';
import {
  BASIS,
  SCENARIOS,
  calculateForecast,
  calculatePeak,
  clampNumber,
  effectiveBagsPerPax,
  effectiveMessagesPerBag,
} from './calculations.js';

const formatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

const defaults = {
  basis: 'departing',
  volumes: { airport: 2_000_000, departing: 1_000_000, flight: 180 },
  departureShare: 0.5,
  coverage: 1,
  scenario: 'base',
  bagMethod: 'direct',
  bagsPerPax: 0.9,
  participation: 0.75,
  bagsPerCheckingPax: 1.2,
  gateBagIncrement: 0,
  messageMethod: 'direct',
  messagesPerBag: 1.3,
  bagsPerInitialEnvelope: 1,
  changeRate: 0.2,
  deleteRate: 0.02,
  reissueRate: 0.03,
  repeatRate: 0.04,
  extraMessages: 0,
  operatingDays: 365,
  busyDayFactor: 1.5,
  peakHourShare: 0.12,
  burstFactor: 1.2,
  backlogMessages: 0,
  recoveryMinutes: 30,
  headroom: 0.25,
};

function Icon({ children, size = 18 }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}

function Info({ text }) {
  return <span className="info" title={text} aria-label={text}>i</span>;
}

function NumericControl({ label, info, value, onChange, min, max, step, unit, disabled = false }) {
  return (
    <label className={`numeric-control ${disabled ? 'disabled' : ''}`}>
      <span className="field-label">{label} {info && <Info text={info} />}</span>
      <span className="number-wrap">
        <input type="number" value={Number.isFinite(value) ? value : 0} min={min} max={max} step={step} disabled={disabled} onChange={(event) => onChange(clampNumber(event.target.value, min, max))} />
        {unit && <span className="unit">{unit}</span>}
      </span>
    </label>
  );
}

function SliderControl({ label, info, value, onChange, min, max, step, unit, displayValue }) {
  const progress = ((value - min) / (max - min)) * 100;
  return (
    <div className="slider-control">
      <div className="slider-heading">
        <span className="field-label">{label} {info && <Info text={info} />}</span>
        <span className="number-wrap compact">
          <input type="number" value={Number.isFinite(value) ? value : 0} min={min} max={max} step={step} onChange={(event) => onChange(clampNumber(event.target.value, min, max))} />
          {unit && <span className="unit">{unit}</span>}
        </span>
      </div>
      <input className="range" style={{ '--progress': `${progress}%` }} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <div className="range-labels"><span>{displayValue ? displayValue(min) : min}</span><span>{displayValue ? displayValue(max) : max}</span></div>
    </div>
  );
}

function Toggle({ value, onChange, left, right, rightValue }) {
  return (
    <div className="toggle" role="group" aria-label={`${left} or ${right}`}>
      <button type="button" className={value === 'direct' ? 'active' : ''} onClick={() => onChange('direct')}>{left}</button>
      <button type="button" className={value !== 'direct' ? 'active' : ''} onClick={() => onChange(rightValue)}>{right}</button>
    </div>
  );
}

function ResultMetric({ label, value, unit, accent }) {
  return (
    <div className={`result-metric ${accent}`}>
      <span>{label}</span>
      <strong>{formatter.format(value)}</strong>
      <small>{unit}</small>
    </div>
  );
}

function Flow({ pax, bags, messages, bagRate, messageRate, unit }) {
  return (
    <div className="flow" aria-label="Passenger to bag to BSM calculation flow">
      <div className="flow-node"><strong>{formatter.format(pax)}</strong><span>departing PAX</span></div>
      <div className="flow-arrow"><span>× {decimalFormatter.format(bagRate)}</span><Icon size={22}><path d="M3 12h17" /><path d="m16 8 4 4-4 4" /></Icon></div>
      <div className="flow-node blue"><strong>{formatter.format(bags)}</strong><span>bags {unit}</span></div>
      <div className="flow-arrow"><span>× {decimalFormatter.format(messageRate)}</span><Icon size={22}><path d="M3 12h17" /><path d="m16 8 4 4-4 4" /></Icon></div>
      <div className="flow-node teal"><strong>{formatter.format(messages)}</strong><span>BSM messages</span></div>
    </div>
  );
}

function ScenarioChart({ passengerVolume, basis, departureShare, coverage }) {
  const rows = Object.entries(SCENARIOS).map(([key, scenario]) => ({ key, ...scenario, ...calculateForecast({ basis, passengerVolume, departureShare, coverage, bagsPerPax: scenario.bagsPerPax, messagesPerBag: scenario.messagesPerBag }) }));
  const max = Math.max(...rows.map((row) => row.messages));
  return (
    <div className="chart-wrap">
      <div className="chart-title"><span>Scenario comparison</span><span className="chart-note">Fixed PAX and coverage</span></div>
      <div className="bar-chart" role="img" aria-label="Low, base, and high baggage and BSM volume comparison">
        {rows.map((row) => (
          <div className="bar-group" key={row.key}>
            <div className="bars">
              <div className="bar bags" style={{ height: `${Math.max(10, (row.bags / max) * 100)}%` }}><span>{compact(row.bags)}</span></div>
              <div className="bar messages" style={{ height: `${Math.max(10, (row.messages / max) * 100)}%` }}><span>{compact(row.messages)}</span></div>
            </div>
            <strong>{row.label}</strong>
          </div>
        ))}
      </div>
      <div className="legend"><span><i className="dot blue-dot" />Expected bags</span><span><i className="dot teal-dot" />Received BSM messages</span></div>
    </div>
  );
}

function compact(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 2).replace(/\.00$/, '')}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 100_000 ? 0 : 1).replace(/\.0$/, '')}K`;
  return formatter.format(value);
}

function CompareTable({ state, bagRate, messageRate }) {
  const rows = ['airport', 'departing', 'flight'].map((basis) => ({ basis, ...calculateForecast({ basis, passengerVolume: state.volumes[basis], departureShare: state.departureShare, coverage: state.coverage, bagsPerPax: bagRate, messagesPerBag: messageRate, extraMessages: state.extraMessages }) }));
  return (
    <div className="compare-table">
      <div className="compare-row compare-head"><span>Input basis</span><span>Departing PAX</span><span>Expected bags</span><span>Received BSMs</span></div>
      {rows.map((row) => <div className="compare-row" key={row.basis}><span><strong>{BASIS[row.basis].short}</strong><small>{formatter.format(state.volumes[row.basis])} entered</small></span><span>{formatter.format(row.departing)}</span><span>{formatter.format(row.bags)}</span><span className="teal-text">{formatter.format(row.messages)}</span></div>)}
      <p>Each row is an independent scenario. Values are never added together.</p>
    </div>
  );
}

function MethodologyModal({ onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="method-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close methodology">×</button>
        <h2 id="method-title">Calculation methodology</h2>
        <p>The calculator keeps passengers, physical bags and received BSM envelopes as separate quantities.</p>
        <div className="formula">BSMs = PAX × departure share × BRS coverage × bags/PAX × BSMs/bag</div>
        <h3>Input boundaries</h3>
        <p>Airport PAX can be converted to departing PAX. Departing and per-flight inputs already represent departing passengers. Compare mode shows alternative scopes; it does not sum them.</p>
        <h3>Advanced decomposition</h3>
        <p>Bags/PAX can be calculated from checked-bag participation × bags among checking passengers, plus any explicit gate-bag increment. BSMs/bag can be decomposed into grouped initial envelopes, CHG, DEL, reissues and repeat delivery.</p>
        <h3>Peak planning</h3>
        <p>Annual messages are converted to a design-day and burst rate using explicit timing factors. This is a planning estimate and should be calibrated with local message logs.</p>
      </section>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState(defaults);
  const [advanced, setAdvanced] = useState(false);
  const [methodology, setMethodology] = useState(false);

  const set = (patch) => setState((current) => ({ ...current, ...patch }));
  const setVolume = (basis, value) => setState((current) => ({ ...current, volumes: { ...current.volumes, [basis]: value } }));

  const bagRate = useMemo(() => effectiveBagsPerPax(state), [state]);
  const messageRate = useMemo(() => effectiveMessagesPerBag(state), [state]);
  const activeBasis = state.basis === 'compare' ? 'departing' : state.basis;
  const result = useMemo(() => calculateForecast({ basis: activeBasis, passengerVolume: state.volumes[activeBasis], departureShare: state.departureShare, coverage: state.coverage, bagsPerPax: bagRate, messagesPerBag: messageRate, extraMessages: state.extraMessages }), [activeBasis, state, bagRate, messageRate]);
  const peak = useMemo(() => activeBasis === 'flight' ? null : calculatePeak({ annualMessages: result.messages, ...state }), [activeBasis, result.messages, state]);

  const chooseScenario = (scenario) => {
    const preset = SCENARIOS[scenario];
    set({ scenario, bagMethod: 'direct', messageMethod: 'direct', bagsPerPax: preset.bagsPerPax, messagesPerBag: preset.messagesPerBag });
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="BSM Calculator home"><span className="brand-mark"><i /><i /></span><strong>BSM Calculator</strong><span>Plan. Size. Operate.</span></a>
        <nav><button onClick={() => setMethodology(true)}><Icon><path d="M5 3h14v18H5z" /><path d="M8 7h8M8 11h8M8 15h5" /></Icon>Methodology</button><span className="nav-rule" /><button onClick={() => setState(defaults)}><Icon><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v6h6" /></Icon>Reset</button></nav>
      </header>

      <main id="top">
        <section className="intro">
          <div><h1>Estimate bags and BSM message volume</h1><p>Model passenger traffic, baggage behaviour and message activity in one place.</p></div>
          <div className="route-motif" aria-hidden="true"><span>PASSENGERS</span><i>→</i><span>BAGS</span><i>→</i><span>BSM MESSAGES</span></div>
        </section>

        <div className="basis-tabs" role="tablist" aria-label="Passenger input basis">
          {[...Object.entries(BASIS), ['compare', { label: 'Compare all' }]].map(([key, item]) => <button key={key} role="tab" aria-selected={state.basis === key} className={state.basis === key ? 'active' : ''} onClick={() => set({ basis: key })}>{item.label}</button>)}
        </div>

        <section className="workspace">
          <div className="assumptions-panel">
            <div className="panel-heading"><div><h2>Key assumptions</h2><p>Adjust the inputs below. Results update automatically.</p></div><div className="scenario-control"><span>Scenario</span><div>{Object.entries(SCENARIOS).map(([key, scenario]) => <button className={state.scenario === key ? 'active' : ''} key={key} onClick={() => chooseScenario(key)}>{scenario.label}</button>)}</div></div></div>

            {state.basis === 'compare' ? (
              <div className="compare-inputs">
                {Object.entries(BASIS).map(([key, item]) => <SliderControl key={key} label={item.label} value={state.volumes[key]} min={item.sliderMin} max={item.sliderMax} step={item.sliderStep} unit={item.unit} onChange={(value) => setVolume(key, value)} displayValue={compact} />)}
              </div>
            ) : (
              <SliderControl label={`Passenger volume (${BASIS[state.basis].short})`} info="The passenger count represented by this scenario." value={state.volumes[state.basis]} min={BASIS[state.basis].sliderMin} max={BASIS[state.basis].sliderMax} step={BASIS[state.basis].sliderStep} unit={BASIS[state.basis].unit} onChange={(value) => setVolume(state.basis, value)} displayValue={compact} />
            )}

            <SliderControl label="Departure share" info="Used only to convert arrivals-plus-departures airport traffic into departing passengers." value={state.departureShare * 100} min={10} max={100} step={1} unit="%" onChange={(value) => set({ departureShare: value / 100 })} displayValue={(value) => `${value}%`} />
            <SliderControl label="BRS coverage" info="Share of departing passengers whose baggage traffic is served by this BRS boundary." value={state.coverage * 100} min={0} max={100} step={1} unit="%" onChange={(value) => set({ coverage: value / 100 })} displayValue={(value) => `${value}%`} />
            <SliderControl label="Bags per PAX" info="Average checked bags per served passenger, including passengers with no checked bag." value={Number(bagRate.toFixed(3))} min={0} max={3} step={0.01} unit="bags" onChange={(value) => set({ bagMethod: 'direct', bagsPerPax: value, scenario: 'custom' })} displayValue={(value) => value.toFixed(1)} />
            <SliderControl label="BSMs per bag" info="Average received BSM envelopes per in-scope bag at the selected interface boundary." value={Number(messageRate.toFixed(3))} min={0} max={5} step={0.01} unit="messages" onChange={(value) => set({ messageMethod: 'direct', messagesPerBag: value, scenario: 'custom' })} displayValue={(value) => value.toFixed(1)} />
          </div>

          <div className="results-panel" aria-live="polite">
            <div className="results-heading"><h2>{state.basis === 'compare' ? 'Independent comparison' : `Results (${state.scenario === 'custom' ? 'Custom' : SCENARIOS[state.scenario].label} scenario)`}</h2><span><i className="live-dot" />Live update</span></div>
            {state.basis === 'compare' ? <CompareTable state={state} bagRate={bagRate} messageRate={messageRate} /> : <>
              <div className="metrics"><ResultMetric label="Expected bags" value={result.bags} unit={`bags ${BASIS[activeBasis].unit}`} accent="blue" /><ResultMetric label="Received BSM messages" value={result.messages} unit={`messages ${BASIS[activeBasis].unit}`} accent="teal" /></div>
              <Flow pax={result.departing} bags={result.bags} messages={result.messages} bagRate={bagRate * state.coverage} messageRate={messageRate} unit={BASIS[activeBasis].unit} />
              <ScenarioChart passengerVolume={state.volumes[activeBasis]} basis={activeBasis} departureShare={state.departureShare} coverage={state.coverage} />
            </>}
          </div>
        </section>

        <section className={`advanced ${advanced ? 'open' : ''}`}>
          <button className="advanced-heading" onClick={() => setAdvanced((value) => !value)} aria-expanded={advanced}><Icon><path d={advanced ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} /></Icon><strong>Advanced settings</strong><span>Refine baggage behaviour, message activity and peak capacity assumptions.</span></button>
          {advanced && <div className="advanced-grid">
            <div className="advanced-group"><div className="group-title"><h3>Baggage behaviour</h3><Toggle value={state.bagMethod} onChange={(bagMethod) => set({ bagMethod, scenario: 'custom' })} left="Direct" right="Behaviour" rightValue="behaviour" /></div>
              <NumericControl label="Checked-bag participation" info="Fraction of passengers checking at least one bag." value={state.participation * 100} min={0} max={100} step={1} unit="%" disabled={state.bagMethod === 'direct'} onChange={(value) => set({ participation: value / 100, scenario: 'custom' })} />
              <NumericControl label="Bags per checking passenger" value={state.bagsPerCheckingPax} min={1} max={5} step={0.01} unit="bags" disabled={state.bagMethod === 'direct'} onChange={(value) => set({ bagsPerCheckingPax: value, scenario: 'custom' })} />
              <NumericControl label="Gate-bag increment" info="Use only when gate-checked bags are excluded from the two inputs above." value={state.gateBagIncrement} min={0} max={2} step={0.01} unit="bags/PAX" disabled={state.bagMethod === 'direct'} onChange={(value) => set({ gateBagIncrement: value, scenario: 'custom' })} />
              <div className="effective"><span>Effective bags per PAX</span><strong>{bagRate.toFixed(3)}</strong></div>
            </div>
            <div className="advanced-group"><div className="group-title"><h3>Message activity</h3><Toggle value={state.messageMethod} onChange={(messageMethod) => set({ messageMethod, scenario: 'custom' })} left="Direct" right="Decompose" rightValue="decomposed" /></div>
              <NumericControl label="Bags per initial BSM" info="Average bag references represented by an initial distinct envelope." value={state.bagsPerInitialEnvelope} min={1} max={10} step={0.01} disabled={state.messageMethod === 'direct'} onChange={(value) => set({ bagsPerInitialEnvelope: value, scenario: 'custom' })} />
              <NumericControl label="CHG envelopes per bag" value={state.changeRate} min={0} max={5} step={0.01} disabled={state.messageMethod === 'direct'} onChange={(value) => set({ changeRate: value, scenario: 'custom' })} />
              <NumericControl label="DEL envelopes per bag" value={state.deleteRate} min={0} max={2} step={0.01} disabled={state.messageMethod === 'direct'} onChange={(value) => set({ deleteRate: value, scenario: 'custom' })} />
              <NumericControl label="Reissue envelopes per bag" value={state.reissueRate} min={0} max={2} step={0.01} disabled={state.messageMethod === 'direct'} onChange={(value) => set({ reissueRate: value, scenario: 'custom' })} />
              <NumericControl label="Repeat delivery ratio" value={state.repeatRate * 100} min={0} max={100} step={1} unit="%" disabled={state.messageMethod === 'direct'} onChange={(value) => set({ repeatRate: value / 100, scenario: 'custom' })} />
              <NumericControl label="Extra received messages" info="Messages outside the modeled passenger/bag cohort." value={state.extraMessages} min={0} max={100_000_000} step={100} unit={activeBasis === 'flight' ? '/flight' : '/year'} onChange={(value) => set({ extraMessages: value })} />
              <div className="effective"><span>Effective BSMs per bag</span><strong>{messageRate.toFixed(3)}</strong></div>
            </div>
            <div className="advanced-group"><div className="group-title"><h3>Peak capacity</h3></div>
              {activeBasis === 'flight' ? <p className="empty-note">Peak throughput needs a time window or annual flight schedule. Per-flight PAX alone is insufficient.</p> : <>
                <NumericControl label="Operating days per year" value={state.operatingDays} min={1} max={366} step={1} unit="days" onChange={(value) => set({ operatingDays: value })} />
                <NumericControl label="Busy-day factor" value={state.busyDayFactor} min={1} max={5} step={0.01} unit="×" onChange={(value) => set({ busyDayFactor: value })} />
                <NumericControl label="Peak-hour share of busy day" value={state.peakHourShare * 100} min={0.1} max={100} step={0.1} unit="%" onChange={(value) => set({ peakHourShare: value / 100 })} />
                <NumericControl label="Burst factor" value={state.burstFactor} min={1} max={20} step={0.01} unit="×" onChange={(value) => set({ burstFactor: value })} />
                <NumericControl label="Recovery backlog" value={state.backlogMessages} min={0} max={10_000_000} step={100} unit="msgs" onChange={(value) => set({ backlogMessages: value })} />
                <NumericControl label="Backlog recovery target" value={state.recoveryMinutes} min={1} max={1440} step={1} unit="min" onChange={(value) => set({ recoveryMinutes: value })} />
                <NumericControl label="Capacity headroom" value={state.headroom * 100} min={0} max={200} step={1} unit="%" onChange={(value) => set({ headroom: value / 100 })} />
                {peak && <div className="peak-result"><span>Design processing rate</span><strong>{decimalFormatter.format(peak.designPerSecond)} <small>messages/sec</small></strong><em>{formatter.format(peak.peakHour)} in peak hour before burst factor</em></div>}
              </>}
            </div>
          </div>}
        </section>
      </main>

      <footer><span><Info text="Local calibration is recommended." /> Estimates depend on local airline mix, baggage behaviour and interface routing.</span><span>BSM Calculator v1.0 · Airport technology planning tool</span></footer>
      {methodology && <MethodologyModal onClose={() => setMethodology(false)} />}
    </div>
  );
}
