export const BASIS = {
  airport: { label: 'Annual airport PAX', short: 'Airport PAX', unit: 'per year', sliderMin: 100_000, sliderMax: 100_000_000, sliderStep: 100_000 },
  departing: { label: 'Annual departing PAX', short: 'Departing PAX', unit: 'per year', sliderMin: 100_000, sliderMax: 50_000_000, sliderStep: 100_000 },
  flight: { label: 'PAX per flight', short: 'Flight PAX', unit: 'per flight', sliderMin: 10, sliderMax: 650, sliderStep: 1 },
};

export const SCENARIOS = {
  low: { label: 'Low', bagsPerPax: 0.6, messagesPerBag: 1.05 },
  base: { label: 'Base', bagsPerPax: 0.9, messagesPerBag: 1.3 },
  high: { label: 'High', bagsPerPax: 1.2, messagesPerBag: 1.8 },
};

export function departingPax(basis, passengerVolume, departureShare) {
  return basis === 'airport' ? passengerVolume * departureShare : passengerVolume;
}

export function effectiveBagsPerPax({ method, bagsPerPax, participation, bagsPerCheckingPax, gateBagIncrement }) {
  if (method === 'behaviour') return participation * bagsPerCheckingPax + gateBagIncrement;
  return bagsPerPax;
}

export function effectiveMessagesPerBag({ method, messagesPerBag, bagsPerInitialEnvelope, changeRate, deleteRate, reissueRate, repeatRate }) {
  if (method === 'decomposed') {
    return (1 / bagsPerInitialEnvelope + changeRate + deleteRate + reissueRate) * (1 + repeatRate);
  }
  return messagesPerBag;
}

export function calculateForecast({ basis, passengerVolume, departureShare, coverage, bagsPerPax, messagesPerBag, extraMessages = 0 }) {
  const departing = departingPax(basis, passengerVolume, departureShare);
  const served = departing * coverage;
  const bags = served * bagsPerPax;
  const messages = bags * messagesPerBag + extraMessages;
  return { departing, served, bags, messages };
}

export function calculatePeak({ annualMessages, operatingDays, busyDayFactor, peakHourShare, burstFactor, backlogMessages, recoveryMinutes, headroom }) {
  if (!Number.isFinite(annualMessages) || annualMessages < 0 || operatingDays <= 0 || recoveryMinutes <= 0) return null;
  const averageDay = annualMessages / operatingDays;
  const designDay = averageDay * busyDayFactor;
  const peakHour = designDay * peakHourShare;
  const peakPerSecond = (peakHour / 3600) * burstFactor;
  const backlogPerSecond = backlogMessages / (recoveryMinutes * 60);
  const designPerSecond = (peakPerSecond + backlogPerSecond) * (1 + headroom);
  return { averageDay, designDay, peakHour, peakPerSecond, designPerSecond };
}

export function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}
