type EpcisEvent = Record<string, unknown>;

type EpcisStore = {
  events: EpcisEvent[];
};

const globalStore = globalThis as typeof globalThis & { __epcisStore?: EpcisStore };

if (!globalStore.__epcisStore) {
  globalStore.__epcisStore = { events: [] };
}

export const getEpcisEvents = () => globalStore.__epcisStore!.events;

export const setEpcisEvents = (events: EpcisEvent[]) => {
  globalStore.__epcisStore!.events = events;
};
