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
  benefit3: string;
  buyBtn: string;
  restoreBtn: string;
  purchaseError: string;
  lockedHint: string;
}

export interface TrialStrings {
  /** shown on Medium button when trials remain, e.g. "Try" */
  badge: string;
  /** appended to count, e.g. "free Medium trials left" */
  left: string;
}

export interface WelcomeStrings {
  title: string;
  body1: string;
  body2: string;
  body3: string;
  body4: string;
  cta: string;
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
    'background-expired': string;
  };
  cores: string;
  core: string;
  waitingForTemp: string;
  therapyTimer: string;
  premium: PremiumStrings;
  trial: TrialStrings;
  welcome: WelcomeStrings;
  /** Calibration screen */
  calibrating: string;
  calibratingOnce: string;
  calibratingNote: string;
  /** Cooldown state */
  cooling: string;
  /** Idle hint under temperature */
  tapToStart: string;
  /** Running hint — tap to stop */
  tapToStop: string;
  /** Badge shown when calibrated with real sensor */
  calibratedDevice: string;
  soundOn: string;
  soundOff: string;
  /** Button label to dismiss the low-battery warning card */
  understood: string;
}

const T: Record<Lang, Translations> = {
  en: {
    tagline: 'thermal pad',
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
    phaseWarming: 'Calibrating peak temperature…',
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
      'background-expired': 'Your session finished while the app was in the background',
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
      benefit2: 'Unlimited therapies',
      buyBtn: 'Unlock now',
      restoreBtn: 'Restore purchase',
      purchaseError: 'Google Play could not start the purchase. Check that Premium is active and try again.',
      lockedHint: 'Premium',
      benefit3: 'Unlimited sessions',
    },
    trial: { badge: 'Try', left: 'free Medium trials left' },
    calibrating: 'Checking maximum temperature for your device…',
    calibratingOnce: 'Once only',
    calibratingNote: 'Please don\'t turn off your phone',
    cooling: 'Cooling down…',
    tapToStart: 'Tap the flame to start',
    tapToStop: 'Tap the flame twice to stop',
    calibratedDevice: 'Calibrated for your device',
    soundOn: 'Sound on',
    soundOff: 'Sound off',
    understood: 'Got it',
    welcome: {
      title: 'Welcome to Warmie',
      body1: 'The maximum temperature reached depends on the brand, model and operating system version of each device. At startup, a maximum temperature test is performed.',
      body2: 'That\'s why Warmie offers 3 free sessions to evaluate the satisfaction achieved with your device.',
      body3: 'Warmie uses 100% of the CPU, preventing optimal use of other apps simultaneously. If you leave the app during an active session it will close to allow you to attend to other apps.',
      body4: 'If you wish, you can remove your device\'s protective case for a greater heat experience.',
      cta: 'Got it',
    },
  },

  es: {
    tagline: 'almohadilla térmica',
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
    phaseWarming: 'Calibrando temperatura del dispositivo… aguarde por favor',
    phaseTherapeutic: 'Terapia activa',
    targetReached: 'Temperatura alcanzada',
    warmingUp: 'Calentamiento',
    safetyTitle: 'Aviso de seguridad',
    safetyBody:
      'Si el nivel de batería desciende al 20% la sesión se interrumpirá de forma automática para cuidar la energía. Asegúrese de contar con carga suficiente antes de iniciar la terapia térmica.',
    autoStop: {
      'time-limit': 'Sesión terapéutica completada',
      'low-battery': 'Batería baja — sesión detenida',
      'tab-hidden': 'Detenido: la app pasó a segundo plano',
      'background-expired': 'Tu sesión terminó mientras la app estaba en segundo plano',
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
      benefit2: 'Terapias ilimitadas',
      buyBtn: 'Desbloquear ahora',
      restoreBtn: 'Restaurar compra',
      purchaseError: 'Google Play no pudo iniciar la compra. Verificá que Premium esté activo y volvé a intentar.',
      lockedHint: 'Premium',
      benefit3: 'Sesiones ilimitadas',
    },
    trial: { badge: 'Probar', left: 'pruebas de Media restantes' },
    calibrating: 'Chequeada temperatura máxima para tu dispositivo…',
    calibratingOnce: 'Es por única vez',
    calibratingNote: 'No apagues el teléfono por favor',
    cooling: 'Enfriando…',
    tapToStart: 'Tocá la llama para iniciar',
    tapToStop: 'Toca 2 veces la llama para terminar',
    calibratedDevice: 'Calibrado para tu dispositivo',
    soundOn: 'Sonido activado',
    soundOff: 'Sin sonido',
    understood: 'Entendido',
    welcome: {
      title: 'Bienvenido a Warmie',
      body1: 'La máxima temperatura alcanzada depende de la marca, modelo y versión del sistema operativo de cada dispositivo. Al inicio se hará un test de temperatura máxima posible.',
      body2: 'Por ello Warmie ofrece la posibilidad de 3 usos gratuitos para evaluar la satisfacción alcanzada con su dispositivo.',
      body3: 'Warmie utiliza el 100% del CPU, imposibilitando el uso óptimo de otras apps en simultáneo. Si sale de la aplicación durante una sesión activa se cerrará para permitir atender a las demás.',
      body4: 'Si lo desea puede quitar la funda protectora del dispositivo para una experiencia mayor de calor.',
      cta: 'Entendido',
    },
  },

  pt: {
    tagline: 'almofada térmica',
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
    phaseWarming: 'Calibrando temperatura máxima…',
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
      'background-expired': 'Sua sessão terminou enquanto o app estava em segundo plano',
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
      benefit2: 'Terapias ilimitadas',
      buyBtn: 'Desbloquear agora',
      restoreBtn: 'Restaurar compra',
      purchaseError: 'O Google Play não conseguiu iniciar a compra. Verifique se o Premium está ativo e tente novamente.',
      lockedHint: 'Premium',
      benefit3: 'Sessões ilimitadas',
    },
    trial: { badge: 'Testar', left: 'testes de Média restantes' },
    calibrating: 'Verificando temperatura máxima do dispositivo…',
    calibratingOnce: 'É uma única vez',
    calibratingNote: 'Não desligue o celular, por favor',
    cooling: 'Esfriando…',
    tapToStart: 'Toque na chama para iniciar',
    tapToStop: 'Toque 2 vezes para parar',
    calibratedDevice: 'Calibrado para o seu dispositivo',
    soundOn: 'Som ativado',
    soundOff: 'Sem som',
    understood: 'Entendido',
    welcome: {
      title: 'Bem-vindo ao Warmie',
      body1: 'A temperatura máxima atingida depende da marca, modelo e versão do sistema operacional de cada dispositivo. No início será realizado um teste de temperatura máxima possível.',
      body2: 'Por isso o Warmie oferece 3 usos gratuitos para avaliar a satisfação com seu dispositivo.',
      body3: 'O Warmie usa 100% da CPU, impedindo o uso ideal de outros apps simultaneamente. Se você sair durante uma sessão ativa ela será encerrada para permitir o uso dos demais.',
      body4: 'Se desejar, retire a capa protetora do dispositivo para uma maior experiência de calor.',
      cta: 'Entendido',
    },
  },

  fr: {
    tagline: 'coussin thermique',
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
    phaseWarming: 'Calibrage de la température maximale…',
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
      'background-expired': "Votre séance s'est terminée pendant que l'app était en arrière-plan",
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
      benefit2: 'Thérapies illimitées',
      buyBtn: 'Débloquer maintenant',
      restoreBtn: "Restaurer l'achat",
      purchaseError: "Google Play n'a pas pu démarrer l'achat. Vérifiez que Premium est actif et réessayez.",
      lockedHint: 'Premium',
      benefit3: 'Sessions illimitées',
    },
    trial: { badge: 'Essai', left: 'essais Moyenne restants' },
    calibrating: "Vérification de la température maximale de l'appareil…",
    calibratingOnce: 'Une seule fois',
    calibratingNote: "Ne pas éteindre le téléphone, s'il vous plaît",
    cooling: 'Refroidissement…',
    tapToStart: 'Appuyez sur la flamme pour démarrer',
    tapToStop: 'Appuyez 2 fois pour arrêter',
    calibratedDevice: 'Calibré pour votre appareil',
    soundOn: 'Son activé',
    soundOff: 'Son désactivé',
    understood: 'Compris',
    welcome: {
      title: 'Bienvenue dans Warmie',
      body1: 'La température maximale atteinte dépend de la marque, du modèle et de la version du système d\'exploitation de chaque appareil. Au démarrage un test de température maximale est effectué.',
      body2: 'C\'est pourquoi Warmie offre 3 utilisations gratuites pour évaluer la satisfaction avec votre appareil.',
      body3: 'Warmie utilise 100 % du CPU, empêchant l\'utilisation optimale d\'autres apps simultanément. Si vous quittez l\'app pendant une session active elle se fermera pour vous permettre d\'utiliser les autres.',
      body4: 'Si vous le souhaitez, retirez la coque de l\'appareil pour une meilleure expérience de chaleur.',
      cta: 'Compris',
    },
  },

  de: {
    tagline: 'Wärmekissen',
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
    phaseWarming: 'Kalibrierung der Maximaltemperatur…',
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
      'background-expired': 'Deine Sitzung endete, während die App im Hintergrund war',
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
      benefit2: 'Unbegrenzte Therapien',
      buyBtn: 'Jetzt freischalten',
      restoreBtn: 'Kauf wiederherstellen',
      purchaseError: 'Google Play konnte den Kauf nicht starten. Prüfe, ob Premium aktiv ist, und versuche es erneut.',
      lockedHint: 'Premium',
      benefit3: 'Unbegrenzte Sitzungen',
    },
    trial: { badge: 'Testen', left: 'Testläufe Mittel übrig' },
    calibrating: 'Maximale Temperatur des Geräts wird ermittelt…',
    calibratingOnce: 'Nur einmal',
    calibratingNote: 'Bitte schalte das Gerät nicht aus',
    cooling: 'Abkühlen…',
    tapToStart: 'Flamme antippen zum Starten',
    tapToStop: '2× tippen zum Stoppen',
    calibratedDevice: 'Kalibriert für dein Gerät',
    soundOn: 'Ton an',
    soundOff: 'Ton aus',
    understood: 'Verstanden',
    welcome: {
      title: 'Willkommen bei Warmie',
      body1: 'Die maximal erreichte Temperatur hängt von Marke, Modell und Betriebssystemversion jedes Geräts ab. Beim Start wird ein Maximaltemperaturtest durchgeführt.',
      body2: 'Daher bietet Warmie 3 kostenlose Nutzungen, um die Zufriedenheit mit Ihrem Gerät zu evaluieren.',
      body3: 'Warmie nutzt 100 % der CPU, was die optimale Nutzung anderer Apps gleichzeitig verhindert. Wenn Sie die App während einer aktiven Sitzung verlassen, wird sie geschlossen.',
      body4: 'Sie können die Schutzhülle des Geräts entfernen, um ein besseres Wärmeerlebnis zu erzielen.',
      cta: 'Verstanden',
    },
  },

  it: {
    tagline: 'cuscinetto termico',
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
    phaseWarming: 'Calibrazione temperatura massima…',
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
      'background-expired': "La sessione è terminata mentre l'app era in background",
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
      benefit2: 'Terapie illimitate',
      buyBtn: 'Sblocca ora',
      restoreBtn: 'Ripristina acquisto',
      purchaseError: "Google Play non ha potuto avviare l'acquisto. Verifica che Premium sia attivo e riprova.",
      lockedHint: 'Premium',
      benefit3: 'Sessioni illimitate',
    },
    trial: { badge: 'Prova', left: 'prove Media rimanenti' },
    calibrating: 'Verifica della temperatura massima del dispositivo…',
    calibratingOnce: 'Solo una volta',
    calibratingNote: 'Non spegnere il telefono, per favore',
    cooling: 'Raffreddamento…',
    tapToStart: 'Tocca la fiamma per iniziare',
    tapToStop: 'Tocca 2 volte per fermare',
    calibratedDevice: 'Calibrato per il tuo dispositivo',
    soundOn: 'Audio attivo',
    soundOff: 'Audio disattivo',
    understood: 'Capito',
    welcome: {
      title: 'Benvenuto in Warmie',
      body1: 'La temperatura massima raggiunta dipende dalla marca, dal modello e dalla versione del sistema operativo di ogni dispositivo. All\'avvio viene eseguito un test della temperatura massima.',
      body2: 'Per questo Warmie offre 3 utilizzi gratuiti per valutare la soddisfazione con il proprio dispositivo.',
      body3: 'Warmie utilizza il 100% della CPU, impedendo l\'uso ottimale di altre app contemporaneamente. Se esci durante una sessione attiva l\'app si chiuderà.',
      body4: 'Se lo desideri puoi rimuovere la custodia protettiva per una maggiore esperienza di calore.',
      cta: 'Capito',
    },
  },

  ru: {
    tagline: 'грелка',
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
    phaseWarming: 'Калибровка максимальной температуры…',
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
      'background-expired': 'Сеанс завершился, пока приложение было в фоне',
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
      benefit2: 'Безлимитные терапии',
      buyBtn: 'Разблокировать сейчас',
      restoreBtn: 'Восстановить покупку',
      purchaseError: 'Google Play не смог запустить покупку. Убедитесь, что Premium активен, и попробуйте снова.',
      lockedHint: 'Премиум',
      benefit3: 'Безлимитные сеансы',
    },
    trial: { badge: 'Проба', left: 'пробных сеанса осталось' },
    calibrating: 'Определение максимальной температуры устройства…',
    calibratingOnce: 'Только один раз',
    calibratingNote: 'Пожалуйста, не выключайте телефон',
    cooling: 'Охлаждение…',
    tapToStart: 'Нажмите на пламя для запуска',
    tapToStop: 'Нажмите 2 раза для остановки',
    calibratedDevice: 'Калибровка выполнена',
    soundOn: 'Звук вкл.',
    soundOff: 'Звук выкл.',
    understood: 'Понятно',
    welcome: {
      title: 'Добро пожаловать в Warmie',
      body1: 'Максимальная температура зависит от марки, модели и версии ОС устройства. При запуске выполняется тест максимально возможной температуры.',
      body2: 'Поэтому Warmie предлагает 3 бесплатных использования для оценки удовлетворённости вашим устройством.',
      body3: 'Warmie использует 100% ЦП, что мешает оптимальной работе других приложений. Если вы выйдете во время сеанса, приложение закроется.',
      body4: 'При желании снимите защитный чехол для большего ощущения тепла.',
      cta: 'Понятно',
    },
  },

  fi: {
    tagline: 'lämpötyyny',
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
    phaseWarming: 'Kalibroidaan huippulämpötilaa…',
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
      'background-expired': 'Istuntosi päättyi sovelluksen ollessa taustalla',
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
      benefit2: 'Rajattomat hoidot',
      buyBtn: 'Avaa nyt',
      restoreBtn: 'Palauta ostos',
      purchaseError: 'Google Play ei voinut aloittaa ostosta. Tarkista, että Premium on aktiivinen, ja yritä uudelleen.',
      lockedHint: 'Premium',
      benefit3: 'Rajattomat istunnot',
    },
    trial: { badge: 'Kokeile', left: 'koeilmaista Keski-istuntoa jäljellä' },
    calibrating: 'Tarkistetaan laitteen maksimilämpötila…',
    calibratingOnce: 'Vain kerran',
    calibratingNote: 'Älä sammuta puhelinta, kiitos',
    cooling: 'Jäähtyminen…',
    tapToStart: 'Käynnistä napauttamalla liekkiä',
    tapToStop: 'Napauta 2 kertaa pysäyttääksesi',
    calibratedDevice: 'Kalibroitu laitteellesi',
    soundOn: 'Ääni päällä',
    soundOff: 'Ääni pois',
    understood: 'Selvä',
    welcome: {
      title: 'Tervetuloa Warmieen',
      body1: 'Saavutettu maksimilämpötila riippuu laitteen merkistä, mallista ja käyttöjärjestelmäversiosta. Käynnistyksen yhteydessä suoritetaan maksimilämpötilatesti.',
      body2: 'Siksi Warmie tarjoaa 3 ilmaista käyttökertaa tyytyväisyyden arvioimiseksi laitteellasi.',
      body3: 'Warmie käyttää 100 % suorittimesta, mikä estää muiden sovellusten optimaalisen käytön. Jos poistut aktiivisen istunnon aikana, sovellus sulkeutuu.',
      body4: 'Voit poistaa laitteen suojakuoren paremman lämpökokemuksen saamiseksi.',
      cta: 'Selvä',
    },
  },

  sv: {
    tagline: 'värmekudde',
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
    phaseWarming: 'Kalibrerar maxtemperatur…',
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
      'background-expired': 'Din session avslutades medan appen var i bakgrunden',
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
      benefit2: 'Obegränsade terapier',
      buyBtn: 'Lås upp nu',
      restoreBtn: 'Återställ köp',
      purchaseError: 'Google Play kunde inte starta köpet. Kontrollera att Premium är aktivt och försök igen.',
      lockedHint: 'Premium',
      benefit3: 'Obegränsade sessioner',
    },
    trial: { badge: 'Prova', left: 'gratis Medelsessioner kvar' },
    calibrating: 'Kontrollerar enhetens maximala temperatur…',
    calibratingOnce: 'Bara en gång',
    calibratingNote: 'Stäng inte av telefonen, tack',
    cooling: 'Avkylning…',
    tapToStart: 'Tryck på lågan för att starta',
    tapToStop: 'Tryck 2 gånger för att stoppa',
    calibratedDevice: 'Kalibrerad för din enhet',
    soundOn: 'Ljud på',
    soundOff: 'Ljud av',
    understood: 'Förstått',
    welcome: {
      title: 'Välkommen till Warmie',
      body1: 'Den maximala temperaturen beror på enhetens märke, modell och OS-version. Vid start utförs ett maxtemperaturtest.',
      body2: 'Därför erbjuder Warmie 3 gratis användningar för att utvärdera nöjdheten med din enhet.',
      body3: 'Warmie använder 100 % av CPU:n, vilket hindrar optimal användning av andra appar. Om du lämnar appen under en aktiv session stängs den.',
      body4: 'Du kan ta bort enhetens skyddsfodral för en bättre värmeupplevelse.',
      cta: 'Förstått',
    },
  },

  mn: {
    tagline: 'дулааны дэвсгэр',
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
    phaseWarming: 'Дээд температурыг тохируулж байна…',
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
      'background-expired': 'Таны сесс апп дэвсгэрт байх үед дуусчээ',
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
      benefit2: 'Хязааргүй эмчилгээ',
      buyBtn: 'Одоо нээх',
      restoreBtn: 'Худалдан авалт сэргээх',
      purchaseError: 'Google Play худалдан авалтыг эхлүүлж чадсангүй. Premium идэвхтэй эсэхийг шалгаад дахин оролдоно уу.',
      lockedHint: 'Премиум',
      benefit3: 'Хязааргүй сессүүд',
    },
    trial: { badge: 'Турших', left: 'дунд эрчмийн туршилт үлдсэн' },
    calibrating: 'Төхөөрөмжийн дээд температурыг шалгаж байна…',
    calibratingOnce: 'Зөвхөн нэг удаа',
    calibratingNote: 'Утсаа унтраахгүй байна уу',
    cooling: 'Хөргөж байна…',
    tapToStart: 'Эхлүүлэхийн тулд гал дээр дарна уу',
    tapToStop: '2 удаа дарж зогсооно уу',
    calibratedDevice: 'Таны төхөөрөмжид тохируулагдсан',
    soundOn: 'Дуу асаалттай',
    soundOff: 'Дуугүй',
    understood: 'Ойлголоо',
    welcome: {
      title: 'Warmie-д тавтай морил',
      body1: 'Хамгийн их температур нь тухайн төхөөрөмжийн брэнд, загвар, үйлдлийн системийн хувилбараас хамаарна. Эхлэхэд дээд температурын тест хийгдэнэ.',
      body2: 'Тиймээс Warmie таны төхөөрөмжийн гүйцэтгэлийг үнэлэхийн тулд 3 үнэгүй ашиглалт санал болгоно.',
      body3: 'Warmie CPU-ийн 100%-ийг ашигладаг тул бусад апп-уудыг зэрэг ашиглах боломжгүй. Идэвхтэй сессийн үед апп-аас гарвал хаагдана.',
      body4: 'Хэрэв хүсвэл илүү их дулаан авахын тулд хамгаалалтын бүрхэвчийг тайлж болно.',
      cta: 'Ойлголоо',
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
    phaseWarming: 'Annerpassumik isikkoq nalunaarsorneqarpoq…',
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
      'background-expired': 'Nalunaarsorneq naaperpoq app-immi silaannassinnaasoqataanngikkaluarluni',
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
      benefit2: 'Nalunngissumik peqqissaarneq',
      buyBtn: 'Atuissavaa siunnersuissavaa',
      restoreBtn: 'Nalunaarusiorfigineqarpoq',
      purchaseError: 'Google Play pisinermi aallartissinnaanngilaq. Premium atorneqarsinnaanersoq misissoruk, taava misileqqiguk.',
      lockedHint: 'Premium',
      benefit3: 'Nalunngissumik nalunaarsorneq',
    },
    trial: { badge: 'Nalunnaarut', left: 'nalunaarsorneqarsinnaanngitsumik' },
    calibrating: 'Isikkoqqissaarissumik nalunaarusiorfigineqarpoq…',
    calibratingOnce: 'Ataatsimoortoqassasoq',
    calibratingNote: 'Telefoni silaannassinnaasoq',
    cooling: 'Isikkoqqissaarissumik…',
    tapToStart: 'Isikkorfigineqarsinnaappoq',
    tapToStop: '2-inik isikkorfigineqassasoq nalinngissumik',
    calibratedDevice: 'Nalunaarusiorfigineqarpoq',
    soundOn: 'Nipaat',
    soundOff: 'Nipaat nalinginnaasumik',
    understood: 'Nalunngissumik',
    welcome: {
      title: 'Warmie-mik isumaginninneqarpoq',
      body1: 'Isikkoqqissaarissumik nalunaarusiorfigineqarsinnaasumik silaannassinnaasoq nalunaarsorneq brand-immi, modeli-mi systemimmi oqimaatsumillu nalunaarusiorfigineqarpoq.',
      body2: 'Tamaattumunnga Warmie 3-inik atugarissaartitsisoqarsinnaappoq nalunaarusiorfigineqarpoq.',
      body3: 'Warmie CPU-p 100%-inik atorpoq, allanik atugarissaartitsissinnaanngikkumik. Nalunaarsorneq silaannassinnaanngikkaluarluni app-immi anissanngikkaluarluni automatikkiimik naalersinnaappoq.',
      body4: 'Isikkoq nalinginnaasumik nalunaarusiorfigineqarpoq telefoni allisinnaanermi.',
      cta: 'Nalunngissumik',
    },
  },
};

export function useTranslations(): Translations {
  return T[detectLang()];
}
