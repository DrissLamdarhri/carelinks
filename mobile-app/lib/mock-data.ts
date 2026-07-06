export const MOROCCAN_CITIES = [
  "Fès",
  "Casablanca",
  "Rabat",
  "Marrakech",
  "Agadir",
  "Tanger",
  "Meknès",
  "Oujda",
  "Salé",
  "Kénitra",
];

export const onboardingSlides = [
  {
    id: "s1",
    icon: "stethoscope",
    title: "Soins à domicile",
    subtitle:
      "Infirmiers, kinés, et professionnels de santé viennent chez vous en quelques minutes.",
  },
  {
    id: "s2",
    icon: "map-pin",
    title: "Vous fixez le prix",
    subtitle:
      "Comme InDrive, proposez votre tarif. Les professionnels acceptent ou font une contre-offre.",
  },
  {
    id: "s3",
    icon: "shield",
    title: "Vérifiés & certifiés",
    subtitle:
      "Tous nos professionnels sont vérifiés : diplôme, CIN et avis patients contrôlés.",
  },
] as const;

export const primaryServices = [
  {
    key: "infirmier",
    label: "Infirmier",
    sub: "À domicile · Dès 60 MAD",
    icon: "syringe",
    gradient: "nurse",
    image:
      "https://images.unsplash.com/photo-1706958581603-dffa91fec580?w=400&q=80",
    route: "/patient",
    tag: "Populaire",
  },
  {
    key: "psy",
    label: "Psychologue",
    sub: "En ligne ou à domicile",
    icon: "brain",
    gradient: "psy",
    image:
      "https://images.unsplash.com/photo-1714976694468-ff722f34d0b6?w=400&q=80",
    route: "/patient",
    tag: null,
  },
  {
    key: "yoga",
    label: "Yoga",
    sub: "Séances individuelles",
    icon: "flower2",
    gradient: "yoga",
    image:
      "https://images.unsplash.com/photo-1767611120077-3697335ec748?w=400&q=80",
    route: "/patient",
    tag: null,
  },
  {
    key: "kine",
    label: "Kiné",
    sub: "Rééducation à domicile",
    icon: "activity",
    gradient: "kine",
    image:
      "https://images.unsplash.com/photo-1545463913-5083aa7359a6?w=400&q=80",
    route: "/patient",
    tag: null,
  },
] as const;

export const quickServices = [
  {
    id: "q1",
    label: "Urgence",
    icon: "zap",
    color: "#E24B4A",
    background: "#FDE8E8",
  },
  {
    id: "q2",
    label: "Pansement",
    icon: "syringe",
    color: "#0D0870",
    background: "#EDE5CC",
  },
  {
    id: "q3",
    label: "Injection",
    icon: "syringe",
    color: "#5BB8D4",
    background: "#D8F0F4",
  },
] as const;

export const mockPatientProfile = {
  id: "p1",
  firstName: "Hassan",
  lastName: "Mohammed",
  city: "Fès",
  avatar:
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&q=80",
};

export const mockProfessionals = [
  // {
  //   id: "n1",
  //   firstName: "Amina",
  //   lastName: "Hassan",
  //   specialty: "infirmier",
  //   city: "Fès",
  //   rating: 4.9,
  //   reviewCount: 124,
  //   minPrice: 80,
  //   phone: "+212612345678",
  //   isOnline: true,
  //   avatar:
  //     "https://images.unsplash.com/photo-1594824475317-d131f6cbf0d8?w=200&q=80",
  // },
  {
    id: "n2",
    firstName: "Yassine",
    lastName: "Benali",
    specialty: "kiné",
    city: "Fès",
    rating: 4.7,
    reviewCount: 89,
    minPrice: 120,
    phone: "+212622111222",
    isOnline: false,
    avatar:
      "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=200&q=80",
  },
  {
    id: "n3",
    firstName: "Salma",
    lastName: "Alaoui",
    specialty: "psychologue",
    city: "Fès",
    rating: 4.8,
    reviewCount: 156,
    minPrice: 150,
    phone: "+212633444555",
    isOnline: true,
    avatar:
      "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&q=80",
  },
];

export const mockPatientBooking = {
  id: "b1",
  proName: "Dr. Amina Hassan",
  careType: "Injection",
  dateStr: "Lun 12 Mai",
  timeStr: "14:30",
};

export const mockProProfile = {
  id: "pro-001",
  name: "Dr. Amina Hassan",
  city: "Fès",
  avatar:
    "https://images.unsplash.com/photo-1594824475317-d131f6cbf0d8?w=200&q=80",
};

export const mockPendingRequests = [
  {
    id: "r1",
    patientName: "Samir El Idrissi",
    careType: "Pansement",
    proposedPrice: 120,
    dateStr: "2026-05-10",
    timeStr: "19:00",
    address: "Avenue Hassan II, Fès",
    createdAt: Date.now() - 1000 * 60 * 20,
  },
  {
    id: "r2",
    patientName: "Nour Bennis",
    careType: "Perfusion",
    proposedPrice: 150,
    dateStr: "2026-05-10",
    timeStr: "20:30",
    address: "Quartier Atlas, Fès",
    createdAt: Date.now() - 1000 * 60 * 55,
  },
];

export const mockProAppointments = [
  {
    id: "a1",
    patientName: "Lina Amrani",
    careType: "Injection",
    dateStr: "2026-05-10",
    timeStr: "09:30",
    address: "Avenue des FAR, Fès",
    status: "confirmed",
    price: 110,
  },
  {
    id: "a2",
    patientName: "Youssef Tahiri",
    careType: "Suivi post-op",
    dateStr: "2026-05-11",
    timeStr: "11:00",
    address: "Route Imouzzer, Fès",
    status: "completed",
    price: 180,
  },
];

export const mockActiveSessions = [
  {
    id: "s1",
    patientName: "Karim Bennani",
    timeElapsed: "28 min",
    duration: "45 min",
  },
];

export const mockCompletedStats = {
  todayEarnings: 640,
  rating: 4.8,
  monthMissions: 22,
  weeklyMissions: 8,
};
