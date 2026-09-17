import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateForecast, calculatePeak, effectiveBagsPerPax, effectiveMessagesPerBag } from './calculations.js';

test('study worked example returns 900k bags and 1.17m messages', () => {
  const result = calculateForecast({ basis: 'departing', passengerVolume: 1_000_000, departureShare: 0.5, coverage: 1, bagsPerPax: 0.9, messagesPerBag: 1.3 });
  assert.equal(result.bags, 900_000);
  assert.equal(result.messages, 1_170_000);
});

test('airport and departing bases are equivalent after departure conversion', () => {
  const airport = calculateForecast({ basis: 'airport', passengerVolume: 2_000_000, departureShare: 0.5, coverage: 1, bagsPerPax: 0.9, messagesPerBag: 1.3 });
  const departing = calculateForecast({ basis: 'departing', passengerVolume: 1_000_000, departureShare: 1, coverage: 1, bagsPerPax: 0.9, messagesPerBag: 1.3 });
  assert.deepEqual(airport, departing);
});

test('behaviour model and decomposed message model match study example', () => {
  assert.ok(Math.abs(effectiveBagsPerPax({ method: 'behaviour', bagsPerPax: 0, participation: 0.75, bagsPerCheckingPax: 1.2, gateBagIncrement: 0 }) - 0.9) < 1e-12);
  assert.ok(Math.abs(effectiveMessagesPerBag({ method: 'decomposed', messagesPerBag: 0, bagsPerInitialEnvelope: 1, changeRate: 0.2, deleteRate: 0.02, reissueRate: 0.03, repeatRate: 0.04 }) - 1.3) < 1e-12);
});

test('grouped initial BSM can result in fewer than one envelope per bag', () => {
  assert.equal(effectiveMessagesPerBag({ method: 'decomposed', messagesPerBag: 0, bagsPerInitialEnvelope: 2, changeRate: 0, deleteRate: 0, reissueRate: 0, repeatRate: 0 }), 0.5);
});

test('peak calculation includes burst, backlog recovery, and headroom', () => {
  const peak = calculatePeak({ annualMessages: 1_170_000, operatingDays: 365, busyDayFactor: 1.5, peakHourShare: 0.12, burstFactor: 1.2, backlogMessages: 10_000, recoveryMinutes: 30, headroom: 0.25 });
  assert.ok(peak.designPerSecond > peak.peakPerSecond);
  assert.ok(peak.peakHour > 0);
});
