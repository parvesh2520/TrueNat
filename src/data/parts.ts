export type PartId =
  | 'housing'
  | 'display'
  | 'lid'
  | 'chip'
  | 'contacts'
  | 'optics'
  | 'fan'
  | 'pcb'
  | 'battery'
  | 'comms'
  | 'ports'

export interface Part {
  id: PartId
  name: string
  kicker: string
  summary: string
  how: string[]
  facts: [string, string][]
}

export const PARTS: Part[] = [
  {
    id: 'chip',
    name: 'Truenat micro-PCR chip',
    kicker: 'Single-use reaction chip',
    summary:
      'The heart of the system. A small ceramic chip that carries its own freeze-dried PCR reagents, a reaction chamber, a printed heater and a temperature sensor. Because the chip heats itself, the analyzer around it can stay tiny.',
    how: [
      '6 µL of purified DNA from the extraction step is pipetted into the chip well.',
      'The liquid rehydrates lyophilised primers, fluorescent probes, polymerase and dNTPs stored inside.',
      'A thin-film heater around the chamber cycles the sample between ~95 °C and ~60 °C.',
      'Each cycle roughly doubles the copies of the target DNA sequence.',
    ],
    facts: [
      ['Sample volume', '6 µL eluate'],
      ['Reagents', 'Lyophilised, room-temp stable'],
      ['Heating', 'On-chip thin-film heater'],
      ['Use', 'Disposable, one test'],
    ],
  },
  {
    id: 'contacts',
    name: 'Heater drive & contact block',
    kicker: 'Thermal control',
    summary:
      'A cradle of spring-loaded gold pins that presses onto the chip’s electrical pads. It powers the chip heater and reads the chip’s temperature sensor in a closed loop.',
    how: [
      'Closing the lid pushes the chip down onto the pogo pins.',
      'The controller reads the on-chip sensor many times per second.',
      'A feedback (PID) loop adjusts heater power to hold each temperature step precisely.',
    ],
    facts: [
      ['Denaturation', '~95 °C'],
      ['Annealing / extension', '~60 °C'],
      ['Control', 'Closed-loop feedback'],
    ],
  },
  {
    id: 'optics',
    name: 'Fluorescence optical module',
    kicker: 'Real-time detection',
    summary:
      'An LED, optical filters and a photodetector looking up into the reaction chamber. After every cycle it measures how much fluorescent light the reaction gives off — that is what makes it real-time PCR.',
    how: [
      'The LED excites the reporter dye on the probe molecules.',
      'Intact probes stay dark: a quencher sits next to the reporter.',
      'As the polymerase copies the target it cleaves the probe, freeing the reporter, which now glows.',
      'More target DNA → more cleaved probes → a brighter signal each cycle.',
    ],
    facts: [
      ['Channels', 'Target + internal control'],
      ['Readout', 'Once per cycle'],
      ['Output', 'Amplification curve, Ct value'],
    ],
  },
  {
    id: 'fan',
    name: 'Cooling fan & heat sink',
    kicker: 'Fast temperature ramps',
    summary:
      'Heating is only half of PCR — the chip must also cool quickly from 95 °C to the annealing temperature. The fan and finned heat sink pull heat away so each cycle stays short.',
    how: [
      'Fins spread heat from the chip cradle into a large surface area.',
      'The fan speeds up during the cool-down step of every cycle.',
      'Faster ramps mean a full PCR run finishes in well under an hour.',
    ],
    facts: [
      ['Active during', 'Cool-down steps'],
      ['Effect', 'Shorter cycle time'],
    ],
  },
  {
    id: 'pcb',
    name: 'Main controller board',
    kicker: 'The brain',
    summary:
      'The microcontroller board runs the thermal protocol, collects the optical readings and runs the analysis that turns a fluorescence curve into a result.',
    how: [
      'Loads the test profile read from the chip/test selection.',
      'Times every heating, cooling and reading step.',
      'Finds the cycle where fluorescence crosses a threshold (the Ct value).',
      'Checks the internal positive control before reporting a valid result.',
    ],
    facts: [
      ['Result', 'Detected / not detected'],
      ['Validity check', 'Internal positive control'],
      ['Storage', 'On-device result log'],
    ],
  },
  {
    id: 'display',
    name: 'Touchscreen interface',
    kicker: 'Operator guidance',
    summary:
      'Walks the operator through each step — patient ID, test selection, loading — and shows the live amplification curve and final result.',
    how: [
      'Step-by-step prompts reduce the training needed to run a molecular test.',
      'Shows temperature, cycle number and the curve as the run progresses.',
      'Displays the final call, which can be printed or sent onward.',
    ],
    facts: [
      ['Shows', 'Live curve, result'],
      ['Input', 'Touch'],
    ],
  },
  {
    id: 'lid',
    name: 'Chip bay lid',
    kicker: 'Light-tight seal',
    summary:
      'Closes over the chip so no room light leaks into the optical path, and clamps the chip firmly against the heater contacts.',
    how: [
      'Blocks ambient light that would swamp the faint fluorescence.',
      'Applies even pressure for good electrical and thermal contact.',
    ],
    facts: [['Role', 'Optical + mechanical seal']],
  },
  {
    id: 'battery',
    name: 'Rechargeable battery pack',
    kicker: 'Works off-grid',
    summary:
      'Lets the analyzer finish a run through power cuts and be used in clinics without stable mains electricity.',
    how: [
      'Charges while connected to the mains adaptor.',
      'Takes over automatically if power drops mid-run, so the test is not lost.',
    ],
    facts: [['Purpose', 'Field and peripheral use']],
  },
  {
    id: 'comms',
    name: 'Connectivity module',
    kicker: 'Results that travel',
    summary:
      'Wireless connectivity sends results to a printer, a laboratory information system or a central server for disease surveillance.',
    how: [
      'Pairs with a printer for a paper report.',
      'Uploads results so programmes can track cases and resistance in near real time.',
    ],
    facts: [['Links', 'Wireless / mobile data']],
  },
  {
    id: 'ports',
    name: 'Rear I/O & power',
    kicker: 'Connections',
    summary:
      'Power input and USB ports at the back of the unit for charging, data export, accessories and software updates.',
    how: ['DC power input charges the battery and runs the device.', 'USB is used for accessories, data export and updates.'],
    facts: [['Ports', 'DC in, USB']],
  },
  {
    id: 'housing',
    name: 'Enclosure',
    kicker: 'Portable shell',
    summary:
      'A compact, sealed housing roughly the size of a lunchbox that protects the optics and electronics, so the analyzer can live on a small bench in a peripheral lab.',
    how: [
      'Keeps dust and stray light away from the optical module.',
      'Small footprint and low power draw make it practical outside big reference labs.',
    ],
    facts: [['Format', 'Benchtop, portable']],
  },
]

export const partById = (id: PartId) => PARTS.find((p) => p.id === id)!
