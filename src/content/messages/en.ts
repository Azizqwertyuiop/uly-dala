import type { Messages } from "./ru";

/*
 * TODO(en-review): черновик английского текста, требует вычитки носителем.
 */
const en: Messages = {
  meta: {
    title: "ULY DALA — full-cycle event agency in Almaty",
    description:
      "Full-cycle event agency in Almaty. Conferences, team building, weddings, kudalyk — at our own venue in the steppe.",
  },
  brand: {
    name: "ULY DALA",
    home: "ULY DALA — home",
  },
  common: {
    skipLink: "Skip to content",
    menu: "Menu",
    discuss: "Discuss your event",
    backHome: "Back to home",
    readMore: "Read more",
  },
  languages: {
    label: "Language",
    kk: "Қазақша",
    ru: "Русский",
    en: "English",
  },
  menu: {
    title: "Menu",
    open: "Menu",
    close: "Close menu",
    chapters: "Chapters",
    pages: "Pages",
    settings: "Settings",
    sound: "Sound",
    soundHint: "Recordings of wind, grass and fire from the venue.",
    briefMode: "Short mode",
    briefModeHint: "The same texts and still frames, no animation.",
    on: "On",
    off: "Off",
  },
  horizon: {
    label: "Site chapters",
  },
  whatsapp: {
    label: "Message us on WhatsApp",
  },
  footer: {
    navLabel: "Site sections",
    chapters: "Chapters",
    pages: "Pages",
    contacts: "Contacts",
    city: "Almaty",
    contactsPending: "Phone and messengers will appear here once confirmed.",
    privacy: "Privacy policy",
    rights: "ULY DALA",
  },
  chapters: {
    dawn: "Dawn",
    assembly: "Assembly",
    day: "Day",
    fire: "Fire",
    world: "This world exists",
    return: "Dawn again",
  },
  hero: {
    time: "05:30",
    title: "We build the world.",
    subtitle:
      "Full-cycle event agency in Almaty. Conferences, team building, weddings, kudalyk — at our own venue in the steppe.",
    proof: "6+ years · our own venue · our own equipment · in-house chef",
    ctaPrimary: "Discuss your event",
    ctaSecondary: "See the venue",
    sceneAlt:
      "The steppe before dawn, covered in feather grass. On the right third of the frame a dark bay horse stands near the horizon, its outline traced by backlight. Above a narrow warm band of dawn — a cold indigo sky.",
  },
  assembly: {
    time: "07:00",
    title: "Full cycle: from the idea to the last guest.",
    manifest:
      "Nomads could raise a whole world in the empty steppe within hours — and take it down without a trace. We do the same.",
    sceneAlt:
      "Morning in the steppe. The lattice walls of a yurt open in a circle, roof poles meet at the centre, the shanyrak crown descends from above.",
    partsLabel: "What an event is made of",
    parts: {
      kerege: {
        name: "Kerege",
        text: "The foundation. Our light, sound and LED screens are our own equipment — no dependence on contractors.",
      },
      uyki: {
        name: "Uyki",
        text: "Dozens of details meeting at one point. Logistics, contractors, timing.",
      },
      shanyrak: {
        name: "Shanyrak",
        text: "It holds everything together. The idea and direction of the event.",
      },
      kiiz: {
        name: "Kiiz",
        text: "Warmth. Service, catering, an in-house chef.",
      },
    },
    pillar: "The shanyrak was the first spotlight.",
    pillarAlt:
      "Inside the finished yurt: a pillar of light falls through the shanyrak, revealing spotlights and sound equipment.",
    forkQuestion: "What is your event?",
    fork: {
      corporate: "A company event",
      family: "A family celebration",
      all: "Show everything",
    },
    cta: "Discuss your event",
  },
  day: {
    time: "12:00",
    title: "The world is ready.",
    lead: "One steppe — six formats. Choose yours.",
    tabsLabel: "Event formats",
    formatPage: "More about this format",
  },
  formats: {
    conference: {
      title: "Conference",
      phrase: "An LED wall in a tent in the middle of the steppe.",
      lead: "Conferences and business events at our own venue near Almaty — with our own equipment, our own kitchen and one team from the idea to the last guest.",
      facts: {
        one: "Our own sound, light and LED screens — no contractors.",
        two: "Stage, registration and timing — one team.",
        three: "Coffee breaks and lunch by our in-house chef.",
      },
      cta: "Discuss a conference",
      sceneAlt:
        "A tent in the steppe with an LED wall and rows of chairs inside; grass and the horizon visible through the opening.",
    },
    coffeeBreak: {
      title: "Coffee break",
      phrase: "Porcelain, copper and steam over the cups.",
      lead: "Coffee breaks for conferences and business meetings: our own coffee machines, pastries and snacks by our in-house chef.",
      facts: {
        one: "Our own coffee machines.",
        two: "Pastries and snacks by our in-house chef.",
        three: "Table setting in the style of the event.",
      },
      cta: "Discuss a coffee break",
      sceneAlt: "A table with porcelain cups and copper coffee pots, steam rising above the cups.",
    },
    teamBuilding: {
      title: "Team building",
      phrase: "The open steppe — a playing field for your team.",
      lead: "Team building tailored to your team in the open spaces of the venue — with a scenario, equipment and lunch cooked over fire.",
      facts: {
        one: "A scenario built around your team’s goals.",
        two: "Our own venue: no need to find and book a location.",
        three: "Lunch over fire by our in-house chef.",
      },
      cta: "Discuss team building",
      sceneAlt: "The open steppe by day, a field for a team game marked out on the grass.",
    },
    kudalyk: {
      title: "Kudalyk",
      phrase: "Two families. One dastarkhan.",
      lead: "Kudalyk is the day two families become one. We know the order of this day and take care of everything, so you can be with your loved ones.",
      facts: {
        one: "We know the order of the day and its traditions.",
        two: "The dastarkhan is prepared by our in-house chef.",
        three: "We take care of everything — you stay with your family.",
      },
      cta: "Discuss a kudalyk",
      sceneAlt:
        "White cloth on a long dastarkhan, its two halves coming together. Only hands and tableware are in the frame.",
    },
    wedding: {
      title: "Wedding",
      phrase: "Evening light over the steppe.",
      lead: "Weddings at our own venue in the steppe: decor, light, sound and banquet — all in-house, with one coordinator.",
      facts: {
        one: "Venue, decor, light and sound — all our own.",
        two: "A banquet by our in-house chef.",
        three: "One coordinator from the idea to the last guest.",
      },
      cta: "Discuss a wedding",
      sceneAlt: "The evening steppe, a long set table under strings of warm lights.",
    },
    privateParty: {
      title: "Private celebration",
      phrase: "A reason to gather your people.",
      lead: "Anniversaries, birthdays and family celebrations at the venue — with full-cycle kitchen, equipment and service.",
      facts: {
        one: "A scenario for your occasion.",
        two: "A menu by our in-house chef.",
        three: "The venue is yours alone.",
      },
      cta: "Discuss a celebration",
      sceneAlt: "A small table by a yurt in warm light, the empty steppe all around.",
    },
  },
  fire: {
    time: "18:00–22:00",
    title: "Our own fire. Our own chef.",
    lead: "We don’t order food — we cook it. Right at the venue.",
    sceneAlt:
      "Macro: embers glowing under a kazan, smoke rising. Below — a top-down view of a set dastarkhan, like an architectural plan.",
    setsLabel: "Menus",
    sets: {
      coffeeBreak: {
        name: "Coffee break",
        text: "Coffee, pastries and light snacks between sessions.",
      },
      banquet: {
        name: "Banquet",
        text: "A full dinner for a celebration or a business evening.",
      },
      traditional: {
        name: "Traditional",
        text: "Kazakh cuisine and a dastarkhan by tradition.",
      },
    },
    cta: "Request the menu",
  },
  world: {
    time: "Night",
    title: "This world exists.",
    lead: "The venue in the steppe near Almaty is our own. Come and see it in person.",
    sceneAlt:
      "A night photograph of the venue: a yurt and a tent under a starry sky, the lights of Almaty in the distance.",
    zonesLabel: "Venue areas",
    zones: {
      field: { name: "Field", text: "Open space for large events." },
      tent: { name: "Tent", text: "A covered space for conferences and banquets." },
      yurt: { name: "Yurt", text: "An intimate space for ceremonies." },
      kitchen: { name: "Kitchen and fire", text: "Where our in-house chef cooks." },
    },
    capacityPending: "Capacity to be confirmed.",
    location: "In the steppe near Almaty.",
    archiveLabel: "Real events",
    logosLabel: "Clients",
    logosPending: "Client logos will appear once approved.",
    reviewsLabel: "Reviews",
    reviewsPending: "Reviews will appear once approved by our clients.",
    cta: "Visit the venue",
    fazendaLink: "About the venue",
  },
  return: {
    time: "05:30",
    title: "We build the world. And take it down without a trace.",
    sceneAlt:
      "The same pre-dawn steppe, now empty: no yurt, no horse. A circle of flattened grass slowly rises.",
  },
  brief: {
    sentence:
      "We are planning {event} {date} {guests}, {venue}. My name is {name}, my number is {phone}.",
    placeholders: {
      event: "[an event]",
      date: "[when]",
      guests: "[how many guests]",
      venue: "[where]",
      name: "[name]",
      phone: "[+7]",
    },
    fragments: {
      eventType: "We are planning",
      date: "Date",
      guests: "How many guests",
      venue: "Where",
      name: "My name is",
      phone: "My number is",
      channel: "Best way to reach me",
    },
    questions: {
      eventType: "What event are you planning?",
      date: "When?",
      visitDate: "When would you like to visit?",
      guests: "How many guests?",
      venue: "Where should it take place?",
      name: "What is your name?",
      phone: "Your phone number",
      channel: "How should we contact you?",
      email: "Your email",
      comment: "Comment",
    },
    required: "required",
    optional: "optional",
    requiredNote: "Only name, phone and consent are required.",
    phoneHint: "For example, +7 701 123 45 67",
    emailHint: "Needed if you chose email.",
    eventTypes: {
      conference: { label: "Conference", phrase: "a conference" },
      "coffee-break": { label: "Coffee break", phrase: "a coffee break" },
      "team-building": { label: "Team building", phrase: "a team building" },
      kudalyk: { label: "Kudalyk", phrase: "a kudalyk" },
      wedding: { label: "Wedding", phrase: "a wedding" },
      "private-party": { label: "Private celebration", phrase: "a private celebration" },
      other: { label: "Other", phrase: "an event" },
    },
    dateModes: {
      month: "We know the month",
      date: "We know the date",
      unknown: "Not sure yet",
    },
    monthLabel: "Month",
    dateLabel: "Date",
    dateUnknownPhrase: "at a date to be decided",
    months: {
      "1": { name: "January", in: "in January" },
      "2": { name: "February", in: "in February" },
      "3": { name: "March", in: "in March" },
      "4": { name: "April", in: "in April" },
      "5": { name: "May", in: "in May" },
      "6": { name: "June", in: "in June" },
      "7": { name: "July", in: "in July" },
      "8": { name: "August", in: "in August" },
      "9": { name: "September", in: "in September" },
      "10": { name: "October", in: "in October" },
      "11": { name: "November", in: "in November" },
      "12": { name: "December", in: "in December" },
    },
    guests: {
      upTo50: { label: "Up to 50", phrase: "for up to 50 guests" },
      "50to150": { label: "50–150", phrase: "for 50–150 guests" },
      "150to500": { label: "150–500", phrase: "for 150–500 guests" },
      "500plus": { label: "Over 500", phrase: "for over 500 guests" },
    },
    venues: {
      ours: { label: "At your venue", phrase: "at your venue" },
      have: { label: "We have a venue", phrase: "we have a venue" },
      help: { label: "Help us choose", phrase: "please help us choose a venue" },
    },
    channels: {
      whatsapp: "WhatsApp",
      call: "Phone call",
      telegram: "Telegram",
      email: "Email",
    },
    consent: "I agree to the processing of my personal data.",
    consentLink: "Privacy policy",
    honeypot: "Leave this field empty",
    submit: "Send the brief",
    submitting: "Sending…",
    errors: {
      summary: "There are errors in the form — they are marked next to the fields.",
      required: "Please fill in this field.",
      invalid: "Please check this value.",
      tooLong: "The text is too long.",
      consent: "Consent to data processing is required.",
      name: "At least two letters, please.",
      phone: "A number in +7 format with 10 digits is needed.",
      email: "Please check the email.",
    },
    success: {
      title: "Thank you! We have your request.",
      text: "A manager will contact you the way you chose.",
      whatsapp: "Message us on WhatsApp now",
      again: "Send another request",
    },
    failure: {
      title: "The request could not be sent.",
      text: "Your details are still in the form — please try again in a minute.",
      rateLimited: "Too many requests in a row. Please try again in a few minutes.",
      whatsapp: "Or message us on WhatsApp",
    },
    done: "Done",
    modalClose: "Close",
    variants: {
      brief: {
        title: "Tell us about your event",
        lead: "Fill in what you know — we will discuss the rest.",
      },
      menu: {
        title: "Request the menu",
        lead: "Leave your contacts — we will send a menu for your event.",
      },
      visit: {
        title: "Visit the venue",
        lead: "We will show you the venue in person. Choose a convenient time.",
      },
    },
  },
  servicePage: {
    factsLabel: "In short",
    otherFormats: "Other formats",
  },
  fazendaPage: {
    metaTitle: "ULY DALA venue — in the steppe near Almaty",
    metaDescription:
      "ULY DALA’s own out-of-town venue in the steppe near Almaty: spaces for conferences, banquets, weddings and kudalyk.",
    title: "This world exists.",
    lead: "ULY DALA’s own venue in the steppe near Almaty. Our events take place here — and you can visit before yours.",
  },
  casesPage: {
    label: "Case",
    task: "The brief",
    solution: "What we did",
    result: "Result",
    format: "Format",
    otherCases: "Other events",
  },
  privacyPage: {
    metaTitle: "Privacy policy — ULY DALA",
    title: "Privacy policy",
    draftNote: "Draft. The final text is to be approved by a lawyer.",
    sections: {
      operator: {
        title: "Who processes the data",
        text: "The personal data operator is ULY DALA, Almaty. Operator details will be listed here.",
      },
      data: {
        title: "What data we collect",
        text: "Your name, phone number, preferred contact method and the event details you provide in the brief.",
      },
      purpose: {
        title: "Why",
        text: "Only to contact you and prepare a proposal for your event.",
      },
      storage: {
        title: "Where and how long it is stored",
        text: "Data is stored in accordance with the Law of the Republic of Kazakhstan “On Personal Data and Their Protection”.",
      },
      rights: {
        title: "Your rights",
        text: "You can request, change or delete your data by writing to us.",
      },
    },
  },
  notFound: {
    title: "Nothing has been set up here yet.",
  },
  typeTest: {
    metaTitle: "Font check",
    title: "Font check",
    intro:
      "Internal page. Every Kazakh letter in every style. If a letter looks different from its neighbours, the font does not contain it.",
    headingFont: "Heading typeface",
    bodyFont: "Body typeface",
    normal: "roman",
    italic: "italic",
    weight: "weight",
  },
};

export default en;
