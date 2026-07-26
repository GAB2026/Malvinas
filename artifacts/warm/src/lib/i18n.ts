export type Lang = 'es' | 'en' | 'pt' | 'fr' | 'de' | 'it';

export function detectLang(): Lang {
  const raw = (navigator.language || 'en').toLowerCase().slice(0, 2);
  const supported: Lang[] = ['es', 'en', 'pt', 'fr', 'de', 'it'];
  return supported.includes(raw as Lang) ? (raw as Lang) : 'en';
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
  },
};

export function useTranslations(): Translations {
  return T[detectLang()];
}
