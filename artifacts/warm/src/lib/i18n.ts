export type Lang = 'es' | 'en' | 'pt' | 'fr' | 'de' | 'it' | 'ru' | 'kl' | 'mn' | 'fi' | 'sv';

export function detectLang(): Lang {
  const raw = (navigator.language || 'en').toLowerCase().slice(0, 2);
  const supported: Lang[] = ['es', 'en', 'pt', 'fr', 'de', 'it', 'ru', 'kl', 'mn', 'fi', 'sv'];
  return supported.includes(raw as Lang) ? (raw as Lang) : 'en';
}

export interface PremiumStrings {
  title: string;
  subtitle: string;
  price: string;
  priceNote: string;
  benefit1: string;
  benefit2: string;
  buyBtn: string;
  restoreBtn: string;
  lockedHint: string;
}

export interface Translations {
  tagline: string;
  intensity: string;
  low: string;
  medium: string;
  high: string;
  start: string;
  stop: string;
  session: string;
  min: string;
  screenAwake: string;
  screenSleep: string;
  tempLabel: string;
  phaseWarming: string;
  phaseTherapeutic: string;
  targetReached: string;
  warmingUp: string;
  safetyTitle: string;
  safetyBody: string;
  autoStop: {
    'time-limit': string;
    'low-battery': string;
    'tab-hidden': string;
  };
  cores: string;
  core: string;
  waitingForTemp: string;
  therapyTimer: string;
  premium: PremiumStrings;
}

const T: Record<Lang, Translations> = {
  en: {
    tagline: 'pocket fireplace',
    intensity: 'Intensity',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    start: 'Start',
    stop: 'Stop',
    session: 'Session',
    min: 'min',
    screenAwake: 'Screen awake',
    screenSleep: 'Screen can sleep',
    tempLabel: 'Device temp',
    phaseWarming: 'Heating up…',
    phaseTherapeutic: 'Therapy active',
    targetReached: 'Target reached',
    warmingUp: 'Warming up',
    safetyTitle: 'Safety Notice',
    safetyBody:
      'This app heats your device by running intensive computations. It drains battery quickly. It auto-stops when battery reaches 15% or if the temperature poses a risk to the device.',
    autoStop: {
      'time-limit': 'Therapeutic session complete',
      'low-battery': 'Battery too low — session stopped',
      'tab-hidden': 'Stopped: app moved to background',
    },
    cores: 'cores',
    core: 'core',
    waitingForTemp: 'Waiting for target temp',
    therapyTimer: 'Therapy time remaining',
    premium: {
      title: 'Unlock Premium',
      subtitle: 'Get the most out of your therapy sessions',
      price: '$2.99',
      priceNote: 'one-time · no subscription',
      benefit1: 'Medium & High intensity',
      benefit2: '30-minute sessions',
      buyBtn: 'Unlock now',
      restoreBtn: 'Restore purchase',
      lockedHint: 'Premium',
    },
  },

  es: {
    tagline: 'chimenea de bolsillo',
    intensity: 'Intensidad',
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
    start: 'Iniciar',
    stop: 'Detener',
    session: 'Sesión',
    min: 'min',
    screenAwake: 'Pantalla activa',
    screenSleep: 'Pantalla puede dormir',
    tempLabel: 'Temp. dispositivo',
    phaseWarming: 'Calentando…',
    phaseTherapeutic: 'Terapia activa',
    targetReached: 'Temperatura alcanzada',
    warmingUp: 'Calentamiento',
    safetyTitle: 'Aviso de seguridad',
    safetyBody:
      'Esta app calienta el dispositivo mediante cálculos intensivos. Consume batería rápidamente. Se detiene automáticamente cuando queda 15 % de batería o la temperatura sea un riesgo para el dispositivo.',
    autoStop: {
      'time-limit': 'Sesión terapéutica completada',
      'low-battery': 'Batería baja — sesión detenida',
      'tab-hidden': 'Detenido: la app pasó a segundo plano',
    },
    cores: 'núcleos',
    core: 'núcleo',
    waitingForTemp: 'Esperando temperatura objetivo',
    therapyTimer: 'Tiempo de terapia restante',
    premium: {
      title: 'Desbloquear Premium',
      subtitle: 'Aprovechá al máximo tus sesiones terapéuticas',
      price: '$2,99',
      priceNote: 'pago único · sin suscripción',
      benefit1: 'Intensidad Media y Alta',
      benefit2: 'Sesiones de 30 minutos',
      buyBtn: 'Desbloquear ahora',
      restoreBtn: 'Restaurar compra',
      lockedHint: 'Premium',
    },
  },

  pt: {
    tagline: 'lareira de bolso',
    intensity: 'Intensidade',
    low: 'Baixa',
    medium: 'Média',
    high: 'Alta',
    start: 'Iniciar',
    stop: 'Parar',
    session: 'Sessão',
    min: 'min',
    screenAwake: 'Tela ativa',
    screenSleep: 'Tela pode dormir',
    tempLabel: 'Temp. dispositivo',
    phaseWarming: 'Aquecendo…',
    phaseTherapeutic: 'Terapia ativa',
    targetReached: 'Temperatura atingida',
    warmingUp: 'Aquecimento',
    safetyTitle: 'Aviso de segurança',
    safetyBody:
      'Este app aquece o dispositivo executando cálculos intensivos. Consome bateria rapidamente. Para automaticamente com 15% de bateria ou se a temperatura representar risco ao dispositivo.',
    autoStop: {
      'time-limit': 'Sessão terapêutica concluída',
      'low-battery': 'Bateria baixa — sessão encerrada',
      'tab-hidden': 'Parado: app foi para segundo plano',
    },
    cores: 'núcleos',
    core: 'núcleo',
    waitingForTemp: 'Aguardando temperatura alvo',
    therapyTimer: 'Tempo de terapia restante',
    premium: {
      title: 'Desbloquear Premium',
      subtitle: 'Aproveite ao máximo suas sessões terapêuticas',
      price: '$2,99',
      priceNote: 'pagamento único · sem assinatura',
      benefit1: 'Intensidade Média e Alta',
      benefit2: 'Sessões de 30 minutos',
      buyBtn: 'Desbloquear agora',
      restoreBtn: 'Restaurar compra',
      lockedHint: 'Premium',
    },
  },

  fr: {
    tagline: 'cheminée de poche',
    intensity: 'Intensité',
    low: 'Faible',
    medium: 'Moyenne',
    high: 'Élevée',
    start: 'Démarrer',
    stop: 'Arrêter',
    session: 'Séance',
    min: 'min',
    screenAwake: 'Écran actif',
    screenSleep: "L'écran peut dormir",
    tempLabel: 'Temp. appareil',
    phaseWarming: 'Chauffe en cours…',
    phaseTherapeutic: 'Thérapie active',
    targetReached: 'Température atteinte',
    warmingUp: 'Montée en chauffe',
    safetyTitle: 'Avis de sécurité',
    safetyBody:
      "Cette app chauffe l'appareil par des calculs intensifs. Elle draine la batterie rapidement. Arrêt automatique quand il reste 15 % de batterie ou si la température représente un risque pour l'appareil.",
    autoStop: {
      'time-limit': 'Séance thérapeutique terminée',
      'low-battery': 'Batterie trop faible — séance arrêtée',
      'tab-hidden': "Arrêté : l'app est passée en arrière-plan",
    },
    cores: 'cœurs',
    core: 'cœur',
    waitingForTemp: 'En attente de la température cible',
    therapyTimer: 'Temps de thérapie restant',
    premium: {
      title: 'Débloquer Premium',
      subtitle: 'Profitez pleinement de vos séances thérapeutiques',
      price: '$2,99',
      priceNote: 'paiement unique · sans abonnement',
      benefit1: 'Intensité Moyenne et Élevée',
      benefit2: 'Séances de 30 minutes',
      buyBtn: 'Débloquer maintenant',
      restoreBtn: "Restaurer l'achat",
      lockedHint: 'Premium',
    },
  },

  de: {
    tagline: 'Taschenkamin',
    intensity: 'Intensität',
    low: 'Niedrig',
    medium: 'Mittel',
    high: 'Hoch',
    start: 'Start',
    stop: 'Stop',
    session: 'Sitzung',
    min: 'Min',
    screenAwake: 'Bildschirm aktiv',
    screenSleep: 'Bildschirm kann schlafen',
    tempLabel: 'Gerätetemp.',
    phaseWarming: 'Aufheizen…',
    phaseTherapeutic: 'Therapie aktiv',
    targetReached: 'Zieltemperatur erreicht',
    warmingUp: 'Aufheizphase',
    safetyTitle: 'Sicherheitshinweis',
    safetyBody:
      'Diese App erhitzt das Gerät durch intensive Berechnungen. Sie entlädt den Akku schnell. Automatischer Stopp bei 15 % Akku oder wenn die Temperatur ein Risiko für das Gerät darstellt.',
    autoStop: {
      'time-limit': 'Therapeutische Sitzung abgeschlossen',
      'low-battery': 'Akku zu niedrig — Sitzung gestoppt',
      'tab-hidden': 'Gestoppt: App im Hintergrund',
    },
    cores: 'Kerne',
    core: 'Kern',
    waitingForTemp: 'Warte auf Zieltemperatur',
    therapyTimer: 'Verbleibende Therapiezeit',
    premium: {
      title: 'Premium freischalten',
      subtitle: 'Nutzen Sie Ihre Therapiesitzungen optimal',
      price: '$2,99',
      priceNote: 'Einmalige Zahlung · kein Abo',
      benefit1: 'Mittlere & hohe Intensität',
      benefit2: '30-Minuten-Sitzungen',
      buyBtn: 'Jetzt freischalten',
      restoreBtn: 'Kauf wiederherstellen',
      lockedHint: 'Premium',
    },
  },

  it: {
    tagline: 'camino tascabile',
    intensity: 'Intensità',
    low: 'Bassa',
    medium: 'Media',
    high: 'Alta',
    start: 'Avvia',
    stop: 'Ferma',
    session: 'Sessione',
    min: 'min',
    screenAwake: 'Schermo attivo',
    screenSleep: 'Lo schermo può dormire',
    tempLabel: 'Temp. dispositivo',
    phaseWarming: 'Riscaldamento…',
    phaseTherapeutic: 'Terapia attiva',
    targetReached: 'Temperatura raggiunta',
    warmingUp: 'Riscaldamento',
    safetyTitle: 'Avviso di sicurezza',
    safetyBody:
      'Questa app riscalda il dispositivo eseguendo calcoli intensivi. Scarica rapidamente la batteria. Si ferma automaticamente quando rimane il 15% di batteria o se la temperatura rappresenta un rischio per il dispositivo.',
    autoStop: {
      'time-limit': 'Sessione terapeutica completata',
      'low-battery': 'Batteria troppo bassa — sessione fermata',
      'tab-hidden': "Fermato: l'app è andata in background",
    },
    cores: 'core',
    core: 'core',
    waitingForTemp: 'In attesa della temperatura target',
    therapyTimer: 'Tempo di terapia rimanente',
    premium: {
      title: 'Sblocca Premium',
      subtitle: 'Sfrutta al massimo le tue sessioni terapeutiche',
      price: '$2,99',
      priceNote: 'pagamento unico · nessun abbonamento',
      benefit1: 'Intensità Media e Alta',
      benefit2: 'Sessioni da 30 minuti',
      buyBtn: 'Sblocca ora',
      restoreBtn: 'Ripristina acquisto',
      lockedHint: 'Premium',
    },
  },

  ru: {
    tagline: 'карманный камин',
    intensity: 'Интенсивность',
    low: 'Низкая',
    medium: 'Средняя',
    high: 'Высокая',
    start: 'Старт',
    stop: 'Стоп',
    session: 'Сеанс',
    min: 'мин',
    screenAwake: 'Экран активен',
    screenSleep: 'Экран может спать',
    tempLabel: 'Темп. устройства',
    phaseWarming: 'Нагрев…',
    phaseTherapeutic: 'Терапия активна',
    targetReached: 'Цель достигнута',
    warmingUp: 'Нагрев',
    safetyTitle: 'Предупреждение',
    safetyBody:
      'Это приложение нагревает устройство интенсивными вычислениями. Быстро расходует батарею. Автоматически останавливается при 15 % заряда или если температура представляет опасность для устройства.',
    autoStop: {
      'time-limit': 'Терапевтический сеанс завершён',
      'low-battery': 'Мало заряда — сеанс остановлен',
      'tab-hidden': 'Остановлено: приложение ушло в фон',
    },
    cores: 'ядер',
    core: 'ядро',
    waitingForTemp: 'Ожидание целевой температуры',
    therapyTimer: 'Оставшееся время терапии',
    premium: {
      title: 'Разблокировать Premium',
      subtitle: 'Максимум от терапевтических сеансов',
      price: '$2,99',
      priceNote: 'разовый платёж · без подписки',
      benefit1: 'Средняя и высокая интенсивность',
      benefit2: 'Сеансы по 30 минут',
      buyBtn: 'Разблокировать сейчас',
      restoreBtn: 'Восстановить покупку',
      lockedHint: 'Премиум',
    },
  },

  fi: {
    tagline: 'taskutakka',
    intensity: 'Teho',
    low: 'Matala',
    medium: 'Keskitaso',
    high: 'Korkea',
    start: 'Käynnistä',
    stop: 'Pysäytä',
    session: 'Istunto',
    min: 'min',
    screenAwake: 'Näyttö aktiivinen',
    screenSleep: 'Näyttö voi nukkua',
    tempLabel: 'Laitteen lämpötila',
    phaseWarming: 'Lämpenee…',
    phaseTherapeutic: 'Hoito käynnissä',
    targetReached: 'Tavoite saavutettu',
    warmingUp: 'Lämpeneminen',
    safetyTitle: 'Turvahuomio',
    safetyBody:
      'Tämä sovellus lämmittää laitetta intensiivisillä laskutoimituksilla. Kuluttaa akkua nopeasti. Pysähtyy automaattisesti kun akku on 15 % tai lämpötila on vaaraksi laitteelle.',
    autoStop: {
      'time-limit': 'Hoitoistunto valmis',
      'low-battery': 'Akku liian heikko — istunto pysäytetty',
      'tab-hidden': 'Pysäytetty: sovellus siirtyi taustalle',
    },
    cores: 'ydintä',
    core: 'ydin',
    waitingForTemp: 'Odotetaan tavoitelämpötilaa',
    therapyTimer: 'Hoitoaikaa jäljellä',
    premium: {
      title: 'Avaa Premium',
      subtitle: 'Hyödynnä hoitoistuntosi täysimääräisesti',
      price: '$2,99',
      priceNote: 'kertamaksu · ei tilausta',
      benefit1: 'Keski- ja korkea teho',
      benefit2: '30 minuutin istunnot',
      buyBtn: 'Avaa nyt',
      restoreBtn: 'Palauta ostos',
      lockedHint: 'Premium',
    },
  },

  sv: {
    tagline: 'fickbrasa',
    intensity: 'Intensitet',
    low: 'Låg',
    medium: 'Medel',
    high: 'Hög',
    start: 'Starta',
    stop: 'Stoppa',
    session: 'Session',
    min: 'min',
    screenAwake: 'Skärm aktiv',
    screenSleep: 'Skärmen kan sova',
    tempLabel: 'Enhetstemperatur',
    phaseWarming: 'Värmer upp…',
    phaseTherapeutic: 'Terapi aktiv',
    targetReached: 'Mål uppnått',
    warmingUp: 'Uppvärmning',
    safetyTitle: 'Säkerhetsmeddelande',
    safetyBody:
      'Den här appen värmer enheten genom intensiva beräkningar. Förbrukar batteriet snabbt. Stoppas automatiskt när batterinivån är 15 % eller om temperaturen utgör en risk för enheten.',
    autoStop: {
      'time-limit': 'Terapisession slutförd',
      'low-battery': 'Batteri för lågt — session stoppad',
      'tab-hidden': 'Stoppad: appen gick till bakgrunden',
    },
    cores: 'kärnor',
    core: 'kärna',
    waitingForTemp: 'Väntar på måltemperatur',
    therapyTimer: 'Återstående terapitid',
    premium: {
      title: 'Lås upp Premium',
      subtitle: 'Få ut det mesta av dina terapisessioner',
      price: '$2,99',
      priceNote: 'engångsbetalning · ingen prenumeration',
      benefit1: 'Medel och hög intensitet',
      benefit2: '30-minuterssessioner',
      buyBtn: 'Lås upp nu',
      restoreBtn: 'Återställ köp',
      lockedHint: 'Premium',
    },
  },

  mn: {
    tagline: 'халааш зуух',
    intensity: 'Эрчим',
    low: 'Бага',
    medium: 'Дунд',
    high: 'Өндөр',
    start: 'Эхлэх',
    stop: 'Зогсоох',
    session: 'Сесс',
    min: 'мин',
    screenAwake: 'Дэлгэц идэвхтэй',
    screenSleep: 'Дэлгэц унтаж болно',
    tempLabel: 'Төхөөрөмжийн хэм',
    phaseWarming: 'Халаж байна…',
    phaseTherapeutic: 'Эмчилгээ идэвхтэй',
    targetReached: 'Зорилт хүрсэн',
    warmingUp: 'Халаалт',
    safetyTitle: 'Аюулгүйн анхааруулга',
    safetyBody:
      'Энэ апп нь эрчимтэй тооцоолол хийж төхөөрөмжийг халаана. Батарейг хурдан шавхана. Батарей 15%-д хүрэхэд эсвэл температур төхөөрөмжид аюул учруулах үед автоматаар зогсоно.',
    autoStop: {
      'time-limit': 'Эмчилгээний сесс дууссан',
      'low-battery': 'Батарей бага — сесс зогссон',
      'tab-hidden': 'Зогссон: апп дэвсгэрт орсон',
    },
    cores: 'цөм',
    core: 'цөм',
    waitingForTemp: 'Зорилтот температурыг хүлээж байна',
    therapyTimer: 'Эмчилгээний үлдсэн хугацаа',
    premium: {
      title: 'Премиум нээх',
      subtitle: 'Эмчилгээний сессуудаа бүрэн ашиглаарай',
      price: '$2.99',
      priceNote: 'нэг удаагийн төлбөр · захиалгагүй',
      benefit1: 'Дунд ба өндөр эрчим',
      benefit2: '30 минутын сесс',
      buyBtn: 'Одоо нээх',
      restoreBtn: 'Худалдан авалт сэргээх',
      lockedHint: 'Премиум',
    },
  },

  kl: {
    tagline: 'isikkoqarfiussissaq',
    intensity: 'Nukissap',
    low: 'Minnerpaamik',
    medium: 'Nalinginnaasumik',
    high: 'Annerpassumik',
    start: 'Atuissavaa',
    stop: 'Nalinngissumik',
    session: 'Nalunaarsorneq',
    min: 'min.',
    screenAwake: 'Isiginnaasoq',
    screenSleep: 'Isiginnaasoqataanngikkaluarluni',
    tempLabel: 'Isikkoq',
    phaseWarming: 'Isikkoqqinnerani…',
    phaseTherapeutic: 'Peqqissaarneq',
    targetReached: 'Nalunaarusiorfigineqarpoq',
    warmingUp: 'Isikkoqqinneq',
    safetyTitle: 'Nalunaarusiorfigineq',
    safetyBody:
      'App-immi isikkoqqissaarissavaa atugarissaarissumillu nalunaarusiorfigineqassasoq. Isikkoq 15%-inik nalinginnaasumik nalunaarusiorfigineqarpoq. Isikkoq annerpassumik nalunaarusiorfigineqassasoq.',
    autoStop: {
      'time-limit': 'Peqqissaarneq naaperpoq',
      'low-battery': 'Isikkoq minnerpaamik — nalinngissumik',
      'tab-hidden': 'Nalinngissumik: nalunaarusiorfigineqarpoq',
    },
    cores: 'isikkorfigineqarsinnaasumit',
    core: 'isikkorfigineqarsinnaasumik',
    waitingForTemp: 'Isikkoq nalunaarusiorfigineqarsinnaappoq',
    therapyTimer: 'Peqqissaarneqarsinnaanngitsumik',
    premium: {
      title: 'Premium atuissavaa',
      subtitle: 'Peqqissaarneqarsinnaanngitsumik nalunaarusiorfigineq',
      price: '$2.99',
      priceNote: 'ataatsimiittarfimmi · nalunaarusiorfigineqarsinnaappoq',
      benefit1: 'Nalinginnaasumik annerpassumillu nukissap',
      benefit2: '30-minutinik nalunaarsorneq',
      buyBtn: 'Atuissavaa siunnersuissavaa',
      restoreBtn: 'Nalunaarusiorfigineqarpoq',
      lockedHint: 'Premium',
    },
  },
};

export function useTranslations(): Translations {
  return T[detectLang()];
}
