import type { Messages } from "./ru";

/*
 * TODO(en-review): черновик английского текста, требует вычитки носителем.
 */
const en: Messages = {
  meta: {
    title: "ULY DALA — full-cycle event agency in Almaty",
    description:
      "Full-cycle event agency in Almaty. Conferences, team building, weddings, kudalyk — at our own venue at the foot of the mountains.",
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
  languageSuggest: {
    label: "Site language",
    text: "This site is available in English.",
    action: "Switch to English",
    dismiss: "Close",
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
    whatsapp: "Message on WhatsApp",
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
      "Full-cycle event agency in Almaty. Conferences, team building, weddings, kudalyk — at our own venue at the foot of the mountains.",
    proof: "6+ years · our own venue · our own equipment · in-house chef",
    ctaPrimary: "Discuss your event",
    scrollHint: "Scroll",
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
        frameAlt:
          "Morning in the steppe. On a circle of flattened grass the lattice walls of a yurt stand open; our own lights, speakers and an LED screen are already inside.",
      },
      uyki: {
        name: "Uyki",
        text: "Dozens of details meeting at one point. Logistics, contractors, timing.",
        frameAlt: "Above the lattice walls, the roof poles meet at the centre.",
      },
      shanyrak: {
        name: "Shanyrak",
        text: "It holds everything together. The idea and direction of the event.",
        frameAlt: "The crown of the dome — the shanyrak — slowly descends onto the poles.",
      },
      kiiz: {
        name: "Kiiz",
        text: "Warmth. Service, catering, an in-house chef.",
        frameAlt: "Felt covers the frame from top to bottom; the door is open, warm light inside.",
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
    ctaCorporate: "Discuss a company event",
    ctaFamily: "Discuss a family celebration",
    rotateLabel: "Rotate the yurt",
    rotateHint: "Drag to rotate",
    rotateHintTouch: "Swipe to rotate",
  },
  day: {
    time: "12:00",
    title: "The world is ready.",
    lead: "One steppe — six formats. Choose yours.",
    tabsLabel: "Event formats",
    formatPage: "More about this format",
    presentation: "Download the presentation",
    presentationMeta: "PDF, 1 KB",
    photoPending: "Event photo coming soon.",
    photoPendingAlt: "{format}: the event photo will appear after the shoot.",
  },
  formats: {
    conference: {
      title: "Conference",
      phrase: "An LED wall in a tent at the foot of the mountains.",
      lead: "Conference organization and business events at our own venue near Almaty — with our own equipment, our own kitchen and one team from the idea to the last guest.",
      facts: {
        one: "Our own sound, light and LED screens — no contractors.",
        two: "Stage, registration and timing — one team.",
        three: "Coffee breaks and lunch by our in-house chef.",
      },
      cta: "Discuss a conference",
      metaTitle: "Conference organization in Almaty — ULY DALA",
      metaDescription:
        "Conference organization and business events near Almaty: our own venue at the foot of the mountains, our own sound, light and LED screens, an in-house chef.",
      // TODO(client-copy) TODO(en-review): частые вопросы — черновик без цифр.
      faq: {
        q1: "Can the conference run on your equipment?",
        a1: "Yes. Sound, light and LED screens are our own equipment — no subcontractors.",
        q2: "Where does the conference take place?",
        a2: "At our venue at the foot of the mountains near Almaty — in a tent or a yurt — or at a venue of your choice.",
        q3: "Who handles coffee breaks and lunch?",
        a3: "Our in-house chef and our own kitchen: we cook on site.",
      },
      sceneAlt:
        "A conference working session: participants at a long table with laptops, a presentation on the wall screen.",
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
      metaTitle: "Coffee breaks for conferences in Almaty — ULY DALA",
      metaDescription:
        "Coffee breaks for conferences and business meetings in Almaty: our own coffee machines, pastries and snacks by our in-house chef.",
      // TODO(client-copy) TODO(en-review): частые вопросы — черновик без цифр.
      faq: {
        q1: "What does a coffee break include?",
        a1: "Coffee from our own machines, pastries and snacks made by our in-house chef.",
        q2: "Can you serve a coffee break at another venue?",
        a2: "Yes, we bring the equipment and the team to your venue in Almaty.",
        q3: "How do we agree on the menu?",
        a3: "Send us a brief — we will send a menu for your event.",
      },
      sceneAlt:
        "A coffee break in a tent: a long table with a dark blue cloth — pastries, a samovar, a buffet sign, stacks of plates, cups and thermos jugs.",
    },
    teamBuilding: {
      title: "Team building",
      phrase: "Open space at the foot of the mountains — a playing field for your team.",
      lead: "Team building tailored to your team in the open spaces of the venue near Almaty — with a scenario, equipment and lunch cooked over fire.",
      facts: {
        one: "A scenario built around your team’s goals.",
        two: "Our own venue: no need to find and book a location.",
        three: "Lunch over fire by our in-house chef.",
      },
      cta: "Discuss team building",
      metaTitle: "Team building near Almaty — ULY DALA",
      metaDescription:
        "Team building at the foot of the mountains near Almaty: a scenario built around your team, our own equipment and lunch cooked over fire.",
      // TODO(client-copy) TODO(en-review): частые вопросы — черновик без цифр.
      faq: {
        q1: "Where does team building take place?",
        a1: "In the open spaces of our venue at the foot of the mountains near Almaty.",
        q2: "Who writes the scenario?",
        a2: "We do: the scenario, equipment and lunch over fire — all in one team.",
        q3: "What if the weather turns?",
        a3: "The venue has covered areas — a tent and a yurt — so the programme continues indoors.",
      },
      sceneAlt:
        "A team-building evening outdoors: guests sit around fire pits in chairs and on benches, a house and string lights behind.",
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
      metaTitle: "Kudalyk in Almaty — ceremony planning | ULY DALA",
      metaDescription:
        "Kudalyk planning in Almaty: the order of the day, a dastarkhan by our in-house chef and our own venue at the foot of the mountains.",
      // TODO(client-copy) TODO(en-review): частые вопросы — черновик без цифр.
      faq: {
        q1: "What is kudalyk?",
        a1: "Kudalyk is a traditional Kazakh engagement ceremony — the day two families become one.",
        q2: "Do you know the order of the ceremony?",
        a2: "Yes. We know the order of this day and take care of the preparations, so you can be with your loved ones.",
        q3: "Who prepares the dastarkhan?",
        a3: "Our in-house chef: traditional dishes are cooked on site.",
      },
      sceneAlt:
        "White cloth on a long dastarkhan, its two halves coming together. Only hands and tableware are in the frame.",
    },
    wedding: {
      title: "Wedding",
      phrase: "Evening light over the foothills.",
      lead: "Weddings at our own venue at the foot of the mountains near Almaty: decor, light, sound and banquet — all in-house, with one coordinator.",
      facts: {
        one: "Venue, decor, light and sound — all our own.",
        two: "A banquet by our in-house chef.",
        three: "One coordinator from the idea to the last guest.",
      },
      cta: "Discuss a wedding",
      metaTitle: "Wedding venue near Almaty — ULY DALA",
      metaDescription:
        "A wedding at our own venue at the foot of the mountains near Almaty: decor, light, sound and banquet all in-house, with one coordinator.",
      // TODO(client-copy) TODO(en-review): частые вопросы — черновик без цифр.
      faq: {
        q1: "Where can we hold a wedding near Almaty?",
        a1: "At our own venue at the foot of the mountains near Almaty — or at a venue of your choice.",
        q2: "What do you take care of?",
        a2: "Decor, light, sound and banquet — all in-house, with one coordinator from the first meeting to the last guest.",
        q3: "Can we visit the venue first?",
        a3: "Yes, come and see the venue — we will agree on a time.",
      },
      sceneAlt:
        "An evening at the foot of the mountains, a long set table under strings of warm lights.",
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
      metaTitle: "Private party venue near Almaty — ULY DALA",
      metaDescription:
        "Anniversaries, birthdays and family celebrations at our venue at the foot of the mountains near Almaty: kitchen, equipment and full-cycle service.",
      // TODO(client-copy) TODO(en-review): частые вопросы — черновик без цифр.
      faq: {
        q1: "What celebrations do you host?",
        a1: "Anniversaries, birthdays and family celebrations.",
        q2: "Where does the party take place?",
        a2: "At our venue at the foot of the mountains near Almaty or at a venue of your choice.",
        q3: "Who cooks?",
        a3: "Our in-house chef and our own kitchen.",
      },
      sceneAlt: "A small table by a yurt in warm light, open foothills all around.",
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
    planLabel: "The dastarkhan from above: dishes of the set",
    listLabel: "Dishes of the set",
    dishes: {
      coffeeBreak: {
        coffee: { name: "Coffee", note: "From our own coffee machines, on site." },
        pastry: { name: "Chef's pastries", note: "Warm, for the start of the break." },
        fruit: { name: "Seasonal fruit", note: "Sliced and whole — whatever is in season." },
        sandwiches: {
          name: "Mini sandwiches",
          note: "Filling but light — until the next session.",
        },
        lemonade: { name: "Lemonades", note: "Homemade, no syrups from a carton." },
        tea: { name: "Tea", note: "Black and herbal." },
      },
      banquet: {
        salads: { name: "Salads", note: "Seasonal vegetables." },
        starters: { name: "Cold starters", note: "The chef's selection." },
        hot: {
          name: "Hot from the fire",
          note: "Cooked right here — over the fire and in the kazan.",
        },
        bread: { name: "Bread and flatbreads", note: "Warm, to go with the main course." },
        dessert: { name: "Dessert", note: "The finale of the dinner." },
        drinks: { name: "Drinks", note: "Berry drinks, lemonades, water." },
      },
      traditional: {
        beshbarmak: {
          name: "Beshbarmak",
          note: "In the kazan, over the fire — the traditional way.",
        },
        kazy: { name: "Kazy and zhaya", note: "Cold meat starters." },
        baursak: { name: "Baursaks", note: "Hot, served with tea." },
        kurt: { name: "Kurt and irimshik", note: "For the table and for the road." },
        fruit: { name: "Fruit", note: "Seasonal." },
        tea: { name: "Tea", note: "With milk, from the samovar." },
      },
    },
  },
  world: {
    time: "Night",
    title: "This world exists.",
    lead: "The venue at the foot of the mountains near Almaty is our own. Come and see it in person.",
    sceneAlt:
      "A night photograph of the venue: a yurt and a tent under a starry sky, the lights of Almaty in the distance.",
    zonesLabel: "Venue areas",
    zones: {
      field: { name: "Field", text: "Open space for large events." },
      tent: { name: "Tent", text: "A covered space for conferences and banquets." },
      yurt: { name: "Yurt", text: "An intimate space for ceremonies." },
      kitchen: { name: "Kitchen and fire", text: "Where our in-house chef cooks." },
    },
    extrasLabel: "Also at the venue",
    extras: {
      gazebo: {
        name: "Covered gazebo",
        text: "A banquet or coffee break under a roof in the open air.",
      },
      fireplaceGazebo: {
        name: "Gazebo with a fireplace",
        text: "A covered gazebo with its own fireplace — for evenings and cool weather.",
      },
      banya: { name: "Banya", text: "Unwind after the programme." },
      cabins: { name: "Guest cabins", text: "Stay until morning." },
      cinema: { name: "Open-air cinema", text: "An evening screening on a big screen." },
      horses: { name: "Horse riding", text: "Rides at the foot of the mountains." },
      archery: { name: "Archery", text: "For team programmes and for guests." },
      atv: { name: "Quad bikes", text: "The active part of the programme." },
    },
    capacityPending: "Capacity to be confirmed.",
    capacity: "{count, plural, one {Up to # guest} other {Up to # guests}}",
    location: "At the foot of the mountains near Almaty.",
    fazendaLabel: "The venue",
    zonesHint: "Keep scrolling — the camera will walk through the areas.",
    mapLabel: "Getting there",
    mapTitle: "Map: the venue at the foot of the mountains and Almaty",
    mapCity: "Almaty",
    mapFazenda: "The venue",
    mapNote: "Not to scale.",
    travel: "{minutes, plural, one {# minute from Almaty} other {# minutes from Almaty}}",
    travelPending: "Travel time to be confirmed.",
    mapPending: "The map pin will appear once the address is confirmed.",
    map2gis: "Open in 2GIS",
    mapGoogle: "Directions in Google Maps",
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
    faqLabel: "Frequently asked questions",
    otherFormats: "Other formats",
  },
  fazendaPage: {
    metaTitle: "ULY DALA venue — at the foot of the mountains near Almaty",
    metaDescription:
      "ULY DALA’s own out-of-town venue at the foot of the mountains near Almaty: spaces for conferences, banquets, weddings and kudalyk.",
    title: "This world exists.",
    lead: "ULY DALA’s own venue at the foot of the mountains near Almaty. Our events take place here — and you can visit before yours.",
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
    metaDescription:
      "How ULY DALA processes personal data from the brief: what we collect, why, where it is stored and how to withdraw consent.",
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
