"use client";

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyBoardFilters,
  BACKLOG_BUCKET,
  BOARD_STATUS_VALUES,
  clearBoardFilter,
  compareBucketLabels,
  getActiveBoardFilters,
  getAvailableBucketFilters,
  getOperationBucketLabel,
  type BoardFilters,
  type BucketFilter,
  parseBoardFilters,
  serializeBoardFilters,
} from './board-filters';
import { createTrpcClient } from '../lib/trpc/client';

type Operation = {
  id: string;
  tenantId: string;
  orderId: string;
  code: string;
  title: string;
  status: 'READY' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';
  startDate?: string;
  endDate?: string;
  sortIndex: number;
  blockedReason?: string;
  version: number;
  dependencyCount: number;
  prerequisiteCodes?: string[];
  prerequisiteOverflowCount?: number;
};

type LoadState = 'idle' | 'loading' | 'loaded' | 'empty' | 'forbidden' | 'error';

type CashflowItem = {
  id: string;
  tenantId: string;
  invoiceId: string;
  kind: 'PLANNED_IN' | 'ACTUAL_IN';
  amount: number;
  currency: 'CZK' | 'EUR';
  date: string;
};

type InvoiceSummary = {
  id: string;
  number: string;
  status: 'DRAFT' | 'ISSUED' | 'PAID';
  amountGross: number;
  currency: 'CZK' | 'EUR';
  dueAt?: string;
  pdfPath: string;
};

type OperationBucket = {
  label: string;
  operations: Operation[];
};

type OperationUpdate = Partial<
  Pick<Operation, 'startDate' | 'status' | 'sortIndex' | 'title' | 'code'>
> & {
  blockedReason?: string | null;
  endDate?: string | null;
};

type ConflictData = {
  code?: string;
  entity?: string;
  id?: string;
  expectedVersion?: number;
  actualVersion?: number;
};

const DEFAULT_BOARD_FILTERS: BoardFilters = {
  status: 'ALL',
  bucket: 'ALL',
  query: '',
};

const HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY = 'planovna.homepage.accessToken';

type HomepageAuthLocaleStrings = {
  boardTitle: string;
  boardIntro: string;
  sessionExpired: string;
  invalidCredentials: string;
  registrationDuplicateEmail: string;
  registrationRateLimit: string;
  registrationFailure: string;
  loginEmailLabel: string;
  loginPasswordLabel: string;
  loginButton: string;
  loginPendingButton: string;
  registerEmailLabel: string;
  registerPasswordLabel: string;
  registerCompanyLabel: string;
  registerButton: string;
  registerPendingButton: string;
  loadOperationsButton: string;
  loadingOperationsButton: string;
  logoutResetSessionButton: string;
  boardReloadFailedKeepLast: string;
  boardConflictReloaded: string;
  boardConflictReloadFailed: string;
  boardLoadFailed: string;
  boardEmpty: string;
  boardForbidden: string;
  cashflowSummarySectionLabel: string;
  cashflowSnapshotTitle: string;
  cashflowPlannedIn: string;
  cashflowActualIn: string;
  invoiceStatusLabel: string;
  invoiceWorkspaceLabel: string;
  openInvoicesWorkspaceLink: string;
  financeSummaryHelper: string;
  nextCashflowItemsLabel: string;
  openCashflowPageLink: string;
  openInvoicesPageLink: string;
  noCashflowItems: string;
  invoiceIssuedSuffix: string;
  invoicePaidSuffix: string;
  invoicesLoadedSuffix: string;
  boardFilterQueryLabel: string;
  boardFilterStatusLabel: string;
  boardFilterBucketLabel: string;
  boardFilterResetButton: string;
  boardSummaryShowingTemplate: string;
  boardFilterBadgeStatusLabel: string;
  boardFilterBadgeBucketLabel: string;
  boardFilterBadgeQueryLabel: string;
  boardFilterClearAriaTemplate: string;
  boardFilteredEmptyTitle: string;
  boardFilteredEmptyHint: string;
  commonAllOption: string;
  operationStatusReady: string;
  operationStatusInProgress: string;
  operationStatusDone: string;
  operationStatusBlocked: string;
  operationCardStatusLabel: string;
};

const HOMEPAGE_AUTH_LOCALES: Record<'cs' | 'en' | 'de', HomepageAuthLocaleStrings> = {
  cs: {
    boardTitle: 'Planovna plánovací nástěnka',
    boardIntro:
      'Lehká plánovací nástěnka pro přesouvání operací mezi backlogem a načtenými koši podle data startu.',
    sessionExpired: 'Relace vypršela. Přihlaste se prosím znovu.',
    invalidCredentials: 'Neplatné přihlašovací údaje',
    registrationDuplicateEmail: 'Tento e-mail je již registrovaný. Přihlaste se prosím.',
    registrationRateLimit: 'Příliš mnoho pokusů o registraci. Počkejte prosím a zkuste to znovu.',
    registrationFailure: 'Registrace selhala. Zkuste to prosím znovu.',
    loginEmailLabel: 'E-mail',
    loginPasswordLabel: 'Heslo',
    loginButton: 'Přihlásit',
    loginPendingButton: 'Přihlašování...',
    registerEmailLabel: 'Registrační e-mail',
    registerPasswordLabel: 'Registrační heslo',
    registerCompanyLabel: 'Název společnosti',
    registerButton: 'Registrovat',
    registerPendingButton: 'Probíhá registrace...',
    loadOperationsButton: 'Načíst operace',
    loadingOperationsButton: 'Načítání operací…',
    logoutResetSessionButton: 'Odhlásit a resetovat relaci',
    boardReloadFailedKeepLast: 'Operace se nepodařilo znovu načíst. Zobrazuje se poslední načtená nástěnka.',
    boardConflictReloaded: 'Nástěnka nebyla aktuální. Načetly se nejnovější operace, zkuste to prosím znovu.',
    boardConflictReloadFailed: 'Nástěnka nebyla aktuální a opětovné načtení selhalo. Načtěte prosím operace znovu.',
    boardLoadFailed: 'Operace se nepodařilo načíst.',
    boardEmpty: 'Nebyly nalezeny žádné operace.',
    boardForbidden: 'Zakázáno: vaše role nemá oprávnění zobrazit operace.',
    cashflowSummarySectionLabel: 'Přehled cashflow',
    cashflowSnapshotTitle: 'Přehled cashflow',
    cashflowPlannedIn: 'Plánovaný příjem',
    cashflowActualIn: 'Skutečný příjem',
    invoiceStatusLabel: 'Stav faktur',
    invoiceWorkspaceLabel: 'Fakturační workspace',
    openInvoicesWorkspaceLink: 'Otevřít fakturační workspace',
    financeSummaryHelper:
      'Zkontrolujte zde stav faktur a pak přejděte přímo na dedikované stránky faktur nebo cashflow pro další finanční krok.',
    nextCashflowItemsLabel: 'Další položky cashflow',
    openCashflowPageLink: 'Otevřít stránku cashflow',
    openInvoicesPageLink: 'Otevřít stránku faktur',
    noCashflowItems: 'Zatím nejsou žádné položky cashflow.',
    invoiceIssuedSuffix: 'vystaveno',
    invoicePaidSuffix: 'zaplaceno',
    invoicesLoadedSuffix: 'faktur načteno',
    boardFilterQueryLabel: 'Kód nebo název',
    boardFilterStatusLabel: 'Stav',
    boardFilterBucketLabel: 'Koš podle data',
    boardFilterResetButton: 'Resetovat filtry',
    boardSummaryShowingTemplate: 'Zobrazeno {filtered} z {total} operací.',
    boardFilterBadgeStatusLabel: 'Stav',
    boardFilterBadgeBucketLabel: 'Koš',
    boardFilterBadgeQueryLabel: 'Dotaz',
    boardFilterClearAriaTemplate: 'Vymazat filtr {label}',
    boardFilteredEmptyTitle: 'Žádné operace neodpovídají aktuálním filtrům.',
    boardFilteredEmptyHint: 'Vymažte filtry, aby se celá nástěnka vrátila bez opětovného načítání operací.',
    commonAllOption: 'Vše',
    operationStatusReady: 'Připraveno',
    operationStatusInProgress: 'Rozpracováno',
    operationStatusDone: 'Hotovo',
    operationStatusBlocked: 'Blokováno',
    operationCardStatusLabel: 'Stav',
  },
  en: {
    boardTitle: 'Planovna operations board',
    boardIntro:
      'Lightweight planning board for moving operations between backlog and loaded start-date buckets.',
    sessionExpired: 'Session expired. Please log in again.',
    invalidCredentials: 'Invalid credentials',
    registrationDuplicateEmail: 'This email is already registered. Please log in instead.',
    registrationRateLimit: 'Too many registration attempts. Please wait a moment and try again.',
    registrationFailure: 'Registration failed. Please try again.',
    loginEmailLabel: 'Email',
    loginPasswordLabel: 'Password',
    loginButton: 'Login',
    loginPendingButton: 'Logging in...',
    registerEmailLabel: 'Registration email',
    registerPasswordLabel: 'Registration password',
    registerCompanyLabel: 'Company name',
    registerButton: 'Register',
    registerPendingButton: 'Registering...',
    loadOperationsButton: 'Load operations',
    loadingOperationsButton: 'Loading operations…',
    logoutResetSessionButton: 'Logout and reset session',
    boardReloadFailedKeepLast: 'Failed to reload operations. Showing the last loaded board.',
    boardConflictReloaded: 'Board was out of date. Reloaded latest operations, please try again.',
    boardConflictReloadFailed: 'Board was out of date and reload failed. Please reload operations again.',
    boardLoadFailed: 'Failed to load operations.',
    boardEmpty: 'No operations found.',
    boardForbidden: 'Forbidden: your role is not allowed to view operations.',
    cashflowSummarySectionLabel: 'Cashflow summary',
    cashflowSnapshotTitle: 'Cashflow snapshot',
    cashflowPlannedIn: 'Planned in',
    cashflowActualIn: 'Actual in',
    invoiceStatusLabel: 'Invoice status',
    invoiceWorkspaceLabel: 'Invoice workspace',
    openInvoicesWorkspaceLink: 'Open invoices workspace',
    financeSummaryHelper:
      'Review invoice status here, then jump directly to the dedicated invoice or cashflow pages for the next finance step.',
    nextCashflowItemsLabel: 'Next cashflow items',
    openCashflowPageLink: 'Open cashflow page',
    openInvoicesPageLink: 'Open invoices page',
    noCashflowItems: 'No cashflow items yet.',
    invoiceIssuedSuffix: 'issued',
    invoicePaidSuffix: 'paid',
    invoicesLoadedSuffix: 'invoices loaded',
    boardFilterQueryLabel: 'Code or title',
    boardFilterStatusLabel: 'Status',
    boardFilterBucketLabel: 'Date bucket',
    boardFilterResetButton: 'Clear filters',
    boardSummaryShowingTemplate: 'Showing {filtered} of {total} operations.',
    boardFilterBadgeStatusLabel: 'Status',
    boardFilterBadgeBucketLabel: 'Bucket',
    boardFilterBadgeQueryLabel: 'Query',
    boardFilterClearAriaTemplate: 'Clear {label} filter',
    boardFilteredEmptyTitle: 'No operations match the current filters.',
    boardFilteredEmptyHint: 'Clear filters to return to the full board without reloading operations.',
    commonAllOption: 'All',
    operationStatusReady: 'Ready',
    operationStatusInProgress: 'In progress',
    operationStatusDone: 'Done',
    operationStatusBlocked: 'Blocked',
    operationCardStatusLabel: 'Status',
  },
  de: {
    boardTitle: 'Planovna-Operationsboard',
    boardIntro:
      'Leichtgewichtiges Planungsboard zum Verschieben von Vorgängen zwischen Backlog und geladenen Startdatum-Buckets.',
    sessionExpired: 'Sitzung abgelaufen. Bitte melden Sie sich erneut an.',
    invalidCredentials: 'Ungültige Anmeldedaten',
    registrationDuplicateEmail: 'Diese E-Mail ist bereits registriert. Bitte melden Sie sich stattdessen an.',
    registrationRateLimit: 'Zu viele Registrierungsversuche. Bitte warten Sie einen Moment und versuchen Sie es erneut.',
    registrationFailure: 'Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut.',
    loginEmailLabel: 'E-Mail',
    loginPasswordLabel: 'Passwort',
    loginButton: 'Anmelden',
    loginPendingButton: 'Anmeldung läuft...',
    registerEmailLabel: 'Registrierungs-E-Mail',
    registerPasswordLabel: 'Registrierungs-Passwort',
    registerCompanyLabel: 'Firmenname',
    registerButton: 'Registrieren',
    registerPendingButton: 'Registrierung läuft...',
    loadOperationsButton: 'Vorgänge laden',
    loadingOperationsButton: 'Vorgänge werden geladen…',
    logoutResetSessionButton: 'Abmelden und Sitzung zurücksetzen',
    boardReloadFailedKeepLast: 'Vorgänge konnten nicht neu geladen werden. Das zuletzt geladene Board wird angezeigt.',
    boardConflictReloaded: 'Das Board war nicht aktuell. Neueste Vorgänge wurden geladen, bitte erneut versuchen.',
    boardConflictReloadFailed: 'Das Board war nicht aktuell und das Neuladen ist fehlgeschlagen. Bitte laden Sie die Vorgänge erneut.',
    boardLoadFailed: 'Vorgänge konnten nicht geladen werden.',
    boardEmpty: 'Keine Vorgänge gefunden.',
    boardForbidden: 'Verboten: Ihre Rolle darf keine Vorgänge anzeigen.',
    cashflowSummarySectionLabel: 'Cashflow-Übersicht',
    cashflowSnapshotTitle: 'Cashflow-Snapshot',
    cashflowPlannedIn: 'Geplant eingehend',
    cashflowActualIn: 'Tatsächlich eingehend',
    invoiceStatusLabel: 'Rechnungsstatus',
    invoiceWorkspaceLabel: 'Rechnungs-Workspace',
    openInvoicesWorkspaceLink: 'Rechnungs-Workspace öffnen',
    financeSummaryHelper:
      'Prüfen Sie hier den Rechnungsstatus und wechseln Sie dann direkt zu den dedizierten Rechnungs- oder Cashflow-Seiten für den nächsten Finanzschritt.',
    nextCashflowItemsLabel: 'Nächste Cashflow-Positionen',
    openCashflowPageLink: 'Cashflow-Seite öffnen',
    openInvoicesPageLink: 'Rechnungsseite öffnen',
    noCashflowItems: 'Noch keine Cashflow-Positionen.',
    invoiceIssuedSuffix: 'ausgestellt',
    invoicePaidSuffix: 'bezahlt',
    invoicesLoadedSuffix: 'Rechnungen geladen',
    boardFilterQueryLabel: 'Code oder Titel',
    boardFilterStatusLabel: 'Status',
    boardFilterBucketLabel: 'Datums-Bucket',
    boardFilterResetButton: 'Filter zurücksetzen',
    boardSummaryShowingTemplate: '{filtered} von {total} Vorgängen werden angezeigt.',
    boardFilterBadgeStatusLabel: 'Status',
    boardFilterBadgeBucketLabel: 'Bucket',
    boardFilterBadgeQueryLabel: 'Suchbegriff',
    boardFilterClearAriaTemplate: 'Filter {label} löschen',
    boardFilteredEmptyTitle: 'Keine Vorgänge entsprechen den aktuellen Filtern.',
    boardFilteredEmptyHint: 'Löschen Sie die Filter, um ohne erneutes Laden der Vorgänge zum vollständigen Board zurückzukehren.',
    commonAllOption: 'Alle',
    operationStatusReady: 'Bereit',
    operationStatusInProgress: 'In Bearbeitung',
    operationStatusDone: 'Erledigt',
    operationStatusBlocked: 'Blockiert',
    operationCardStatusLabel: 'Status',
  },
};

const resolveAuthBaseUrl = () => {
  const trpcUrl = process.env.NEXT_PUBLIC_API_TRPC_URL ?? 'http://localhost:3000/trpc';
  const withoutTrailingSlash = trpcUrl.replace(/\/+$/, '');
  return withoutTrailingSlash.replace(/\/trpc$/, '');
};

const getRegistrationEndpoint = () => `${resolveAuthBaseUrl()}/auth/register`;

const defaultBoardFilters = (): BoardFilters => {
  if (typeof window === 'undefined') {
    return DEFAULT_BOARD_FILTERS;
  }

  return parseBoardFilters(new URLSearchParams(window.location.search));
};

const hasForbiddenCode = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    data?: { code?: string };
    shape?: { data?: { code?: string } };
  };

  return candidate.data?.code === 'FORBIDDEN' || candidate.shape?.data?.code === 'FORBIDDEN';
};

const extractConflictData = (error: unknown): ConflictData | null => {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const candidate = error as {
    data?: { code?: string; conflict?: ConflictData };
    shape?: { data?: { code?: string; conflict?: ConflictData } };
  };

  const conflict = candidate.data?.conflict ?? candidate.shape?.data?.conflict;
  const code = candidate.data?.code ?? candidate.shape?.data?.code;

  if (code !== 'CONFLICT' || !conflict) {
    return null;
  }

  return conflict;
};

const compareOperations = (left: Operation, right: Operation) => {
  if (left.sortIndex !== right.sortIndex) {
    return left.sortIndex - right.sortIndex;
  }

  const leftFallback = left.code || left.id;
  const rightFallback = right.code || right.id;

  return leftFallback.localeCompare(rightFallback);
};

const buildBuckets = (operations: Operation[]): OperationBucket[] => {
  const bucketMap = new Map<string, Operation[]>();

  for (const operation of operations) {
    const bucketLabel = getOperationBucketLabel(operation.startDate);
    const bucketOperations = bucketMap.get(bucketLabel) ?? [];
    bucketOperations.push(operation);
    bucketMap.set(bucketLabel, bucketOperations);
  }

  return Array.from(bucketMap.entries())
    .sort(([leftLabel], [rightLabel]) => compareBucketLabels(leftLabel, rightLabel))
    .map(([label, bucketOperations]) => ({
      label,
      operations: [...bucketOperations].sort(compareOperations),
    }));
};

const toStartDate = (bucketLabel: BucketFilter) =>
  bucketLabel === BACKLOG_BUCKET ? undefined : `${bucketLabel}T00:00:00.000Z`;

const isDateBucket = (value: string): value is Exclude<BucketFilter, 'ALL' | typeof BACKLOG_BUCKET> =>
  /^\d{4}-\d{2}-\d{2}$/.test(value);

const getScheduledDateValue = (operation: Operation, scheduleDates: Record<string, string>) =>
  scheduleDates[operation.id] ?? operation.startDate?.slice(0, 10) ?? '';

const getEndDateValue = (operation: Operation, endDateDrafts: Record<string, string>) =>
  endDateDrafts[operation.id] ?? operation.endDate?.slice(0, 10) ?? '';

const getBlockedReasonValue = (operation: Operation, blockedReasonDrafts: Record<string, string>) =>
  blockedReasonDrafts[operation.id] ?? operation.blockedReason ?? '';

const getTitleValue = (operation: Operation, titleDrafts: Record<string, string>) =>
  titleDrafts[operation.id] ?? operation.title;

const getCodeValue = (operation: Operation, codeDrafts: Record<string, string>) =>
  codeDrafts[operation.id] ?? operation.code;

const getSortIndexValue = (operation: Operation, sortIndexDrafts: Record<string, string>) =>
  sortIndexDrafts[operation.id] ?? String(operation.sortIndex);

const buildBlockedReasonDrafts = (operations: Operation[]) =>
  operations.reduce<Record<string, string>>((drafts, operation) => {
    drafts[operation.id] = operation.blockedReason ?? '';
    return drafts;
  }, {});

const buildTitleDrafts = (operations: Operation[]) =>
  operations.reduce<Record<string, string>>((drafts, operation) => {
    drafts[operation.id] = operation.title;
    return drafts;
  }, {});

const buildCodeDrafts = (operations: Operation[]) =>
  operations.reduce<Record<string, string>>((drafts, operation) => {
    drafts[operation.id] = operation.code;
    return drafts;
  }, {});

const buildEndDateDrafts = (operations: Operation[]) =>
  operations.reduce<Record<string, string>>((drafts, operation) => {
    drafts[operation.id] = operation.endDate?.slice(0, 10) ?? '';
    return drafts;
  }, {});

const buildSortIndexDrafts = (operations: Operation[]) =>
  operations.reduce<Record<string, string>>((drafts, operation) => {
    drafts[operation.id] = String(operation.sortIndex);
    return drafts;
  }, {});

const buildScheduleDateDrafts = (operations: Operation[]) =>
  operations.reduce<Record<string, string>>((drafts, operation) => {
    drafts[operation.id] = operation.startDate?.slice(0, 10) ?? '';
    return drafts;
  }, {});

const formatPrerequisiteSummary = (operation: Operation) => {
  if (!operation.prerequisiteCodes || operation.prerequisiteCodes.length === 0) {
    return null;
  }

  const overflowCount = operation.prerequisiteOverflowCount ?? 0;
  const overflowSuffix = overflowCount > 0 ? ` +${overflowCount} more` : '';

  return `Waiting on ${operation.prerequisiteCodes.join(', ')}${overflowSuffix}`;
};

const formatMoney = (amount: number, currency: CashflowItem['currency']) =>
  new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

export default function Home() {
  const [email, setEmail] = useState('owner@tenant-a.local');
  const [password, setPassword] = useState('tenant-a-pass');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerCompanyName, setRegisterCompanyName] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loginPending, setLoginPending] = useState(false);
  const [registerPending, setRegisterPending] = useState(false);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [cashflowItems, setCashflowItems] = useState<CashflowItem[]>([]);
  const [invoiceSummaries, setInvoiceSummaries] = useState<InvoiceSummary[]>([]);
  const [authMessage, setAuthMessage] = useState('');
  const [boardMessage, setBoardMessage] = useState('');
  const [operationLoadState, setOperationLoadState] = useState<LoadState>('idle');
  const [mutatingOperationId, setMutatingOperationId] = useState<string | null>(null);
  const [scheduleDates, setScheduleDates] = useState<Record<string, string>>({});
  const [endDateDrafts, setEndDateDrafts] = useState<Record<string, string>>({});
  const [blockedReasonDrafts, setBlockedReasonDrafts] = useState<Record<string, string>>({});
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});
  const [codeDrafts, setCodeDrafts] = useState<Record<string, string>>({});
  const [sortIndexDrafts, setSortIndexDrafts] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<BoardFilters>(defaultBoardFilters);
  const hydrationAutoLoadPendingRef = useRef(false);
  const loginPendingRef = useRef(false);
  const registerPendingRef = useRef(false);
  const manualOperationLoadPendingRef = useRef(false);
  const mutatingOperationIdRef = useRef<string | null>(null);
  const operationLoadSessionRef = useRef(0);

  const completeAuthSession = (nextAccessToken: string) => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, nextAccessToken);
    setAccessToken(nextAccessToken);
    resetOperationsState();
    setAuthMessage('Logged in');

    const authenticatedClient = createTrpcClient(nextAccessToken);
    void loadCashflow(authenticatedClient);
    void loadInvoices(authenticatedClient);
    void loadOperations(authenticatedClient).catch(() => {
      // state is already updated in loadOperations
    });
  };

  const trpcClient = useMemo(
    () => createTrpcClient(accessToken ?? undefined),
    [accessToken],
  );

  const availableBucketFilters = useMemo(() => getAvailableBucketFilters(operations), [operations]);
  const moveBucketOptions = useMemo(
    () => availableBucketFilters.filter((bucket): bucket is Exclude<BucketFilter, 'ALL'> => bucket !== 'ALL'),
    [availableBucketFilters],
  );
  const filteredOperations = useMemo(() => applyBoardFilters(operations, filters), [operations, filters]);
  const activeFilters = useMemo(() => getActiveBoardFilters(filters), [filters]);
  const operationBuckets = useMemo(() => buildBuckets(filteredOperations), [filteredOperations]);
  const cashflowSummary = useMemo(() => {
    const plannedIn = cashflowItems
      .filter((item) => item.kind === 'PLANNED_IN')
      .reduce((sum, item) => sum + item.amount, 0);
    const actualIn = cashflowItems
      .filter((item) => item.kind === 'ACTUAL_IN')
      .reduce((sum, item) => sum + item.amount, 0);

    return {
      plannedIn,
      actualIn,
      nextItems: [...cashflowItems]
        .sort((left, right) => left.date.localeCompare(right.date))
        .slice(0, 3),
    };
  }, [cashflowItems]);
  const invoiceSummary = useMemo(() => {
    const issuedCount = invoiceSummaries.filter((invoice) => invoice.status === 'ISSUED').length;
    const paidCount = invoiceSummaries.filter((invoice) => invoice.status === 'PAID').length;

    return {
      totalCount: invoiceSummaries.length,
      issuedCount,
      paidCount,
    };
  }, [invoiceSummaries]);
  const showOperationBoard =
    operations.length > 0 && (operationLoadState === 'loaded' || operationLoadState === 'loading');
  const isFilteredEmptyState =
    operationLoadState === 'loaded' && operations.length > 0 && filteredOperations.length === 0;
  const showActiveFilterSummary = operationLoadState === 'loaded' && activeFilters.length > 0;
  const boardSummaryShowingText = HOMEPAGE_AUTH_LOCALES.en.boardSummaryShowingTemplate
    .replace('{filtered}', String(filteredOperations.length))
    .replace('{total}', String(operations.length));
  const getActiveFilterLabel = (key: (typeof activeFilters)[number]['key']) => {
    switch (key) {
      case 'status':
        return HOMEPAGE_AUTH_LOCALES.en.boardFilterBadgeStatusLabel;
      case 'bucket':
        return HOMEPAGE_AUTH_LOCALES.en.boardFilterBadgeBucketLabel;
      case 'query':
        return HOMEPAGE_AUTH_LOCALES.en.boardFilterBadgeQueryLabel;
      default:
        return key;
    }
  };
  const getLocalizedOperationStatusLabel = (status: Operation['status']) => {
    switch (status) {
      case 'READY':
        return HOMEPAGE_AUTH_LOCALES.en.operationStatusReady;
      case 'IN_PROGRESS':
        return HOMEPAGE_AUTH_LOCALES.en.operationStatusInProgress;
      case 'DONE':
        return HOMEPAGE_AUTH_LOCALES.en.operationStatusDone;
      case 'BLOCKED':
        return HOMEPAGE_AUTH_LOCALES.en.operationStatusBlocked;
      default:
        return status;
    }
  };

  useEffect(() => {
    if (
      operationLoadState === 'loaded' &&
      filters.bucket !== 'ALL' &&
      !availableBucketFilters.includes(filters.bucket)
    ) {
      setFilters((currentFilters) => ({ ...currentFilters, bucket: 'ALL' }));
    }
  }, [availableBucketFilters, filters.bucket, operationLoadState]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedAccessToken = window.localStorage.getItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY);

    if (!storedAccessToken) {
      return;
    }

    hydrationAutoLoadPendingRef.current = true;
    setAccessToken(storedAccessToken);
    setAuthMessage('Logged in');
  }, []);

  useEffect(() => {
    if (!accessToken || !hydrationAutoLoadPendingRef.current) {
      return;
    }

    hydrationAutoLoadPendingRef.current = false;
    resetOperationsState();

    const hydratedClient = createTrpcClient(accessToken);
    void loadCashflow(hydratedClient);
    void loadInvoices(hydratedClient);
    void loadOperations(hydratedClient).catch(() => {
      // state is already updated in loadOperations
    });
  }, [accessToken]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const nextSearchParams = serializeBoardFilters(
      filters,
      new URLSearchParams(window.location.search),
    );
    const nextQuery = nextSearchParams.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;

    window.history.replaceState(window.history.state, '', nextUrl);
  }, [filters]);

  const resetOperationsState = () => {
    setOperations([]);
    setCashflowItems([]);
    setInvoiceSummaries([]);
    setBoardMessage('');
    mutatingOperationIdRef.current = null;
    setMutatingOperationId(null);
    setScheduleDates({});
    setEndDateDrafts({});
    setBlockedReasonDrafts({});
    setTitleDrafts({});
    setCodeDrafts({});
    setSortIndexDrafts({});
    setOperationLoadState('idle');
  };

  const invalidateOperationLoads = () => {
    operationLoadSessionRef.current += 1;
  };

  const resetSession = (message = 'Logged out') => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY);
    }

    invalidateOperationLoads();
    hydrationAutoLoadPendingRef.current = false;
    setAccessToken(null);
    resetOperationsState();
    setAuthMessage(message);
  };

  const loadCashflow = async (client = trpcClient) => {
    try {
      const result = await client.cashflow.list.query();
      setCashflowItems(result as CashflowItem[]);
    } catch {
      setCashflowItems([]);
    }
  };

  const loadInvoices = async (client = trpcClient) => {
    try {
      const result = await client.invoice.list.query();
      setInvoiceSummaries((result as InvoiceSummary[]).slice(0, 5));
    } catch {
      setInvoiceSummaries([]);
    }
  };

  const loadOperations = async (client = trpcClient) => {
    const loadSession = operationLoadSessionRef.current;
    const hadLoadedBoard = operations.length > 0 && operationLoadState === 'loaded';
    setOperationLoadState('loading');

    try {
      const result = await client.operation.list.query();
      if (loadSession !== operationLoadSessionRef.current) {
        return [];
      }

      const loadedOperations = result as Operation[];
      setOperations(loadedOperations);
      setBoardMessage('');
      setScheduleDates(buildScheduleDateDrafts(loadedOperations));
      setEndDateDrafts(buildEndDateDrafts(loadedOperations));
      setBlockedReasonDrafts(buildBlockedReasonDrafts(loadedOperations));
      setTitleDrafts(buildTitleDrafts(loadedOperations));
      setCodeDrafts(buildCodeDrafts(loadedOperations));
      setSortIndexDrafts(buildSortIndexDrafts(loadedOperations));
      setOperationLoadState(loadedOperations.length > 0 ? 'loaded' : 'empty');
      return loadedOperations;
    } catch (error) {
      if (loadSession !== operationLoadSessionRef.current) {
        return [];
      }

      if (hasForbiddenCode(error)) {
        resetSession(homepageAuthCopy.sessionExpired);
      } else if (hadLoadedBoard) {
        setBoardMessage(homepageAuthCopy.boardReloadFailedKeepLast);
        setOperationLoadState('loaded');
      } else {
        setOperations([]);
        setOperationLoadState('error');
      }

      throw error;
    }
  };

  const onLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (loginPendingRef.current) {
      return;
    }

    loginPendingRef.current = true;
    setLoginPending(true);
    setAuthMessage('');

    try {
      const result = await trpcClient.auth.login.mutate({ email, password });
      const nextAccessToken = result.accessToken;
      completeAuthSession(nextAccessToken);
    } catch {
      resetSession();
      setAuthMessage(homepageAuthCopy.invalidCredentials);
    } finally {
      loginPendingRef.current = false;
      setLoginPending(false);
    }
  };

  const onRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (registerPendingRef.current) {
      return;
    }

    registerPendingRef.current = true;
    setRegisterPending(true);
    setAuthMessage('');

    try {
      const response = await fetch(getRegistrationEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: registerEmail,
          password: registerPassword,
          companyName: registerCompanyName,
        }),
      });

      if (!response.ok) {
        if (response.status === 409) {
          setAuthMessage(homepageAuthCopy.registrationDuplicateEmail);
          return;
        }

        if (response.status === 429) {
          setAuthMessage(homepageAuthCopy.registrationRateLimit);
          return;
        }

        setAuthMessage(homepageAuthCopy.registrationFailure);
        return;
      }

      const result = (await response.json()) as { accessToken: string };
      const nextAccessToken = result.accessToken;
      completeAuthSession(nextAccessToken);
    } catch {
      setAuthMessage(homepageAuthCopy.registrationFailure);
    } finally {
      registerPendingRef.current = false;
      setRegisterPending(false);
    }
  };

  const onLoadOperations = async () => {
    if (manualOperationLoadPendingRef.current || mutatingOperationIdRef.current !== null) {
      return;
    }

    manualOperationLoadPendingRef.current = true;

    try {
      await loadOperations();
    } catch {
      // state is already updated in loadOperations
    } finally {
      manualOperationLoadPendingRef.current = false;
    }
  };

  const onUpdateOperation = async (
    operation: Operation,
    updates: OperationUpdate,
    failureMessage: string,
  ) => {
    if (mutatingOperationIdRef.current !== null) {
      return;
    }

    setBoardMessage('');
    mutatingOperationIdRef.current = operation.id;
    setMutatingOperationId(operation.id);
    const mutationSession = operationLoadSessionRef.current;

    try {
      const updatedOperation = (await trpcClient.operation.update.mutate({
        id: operation.id,
        tenantId: operation.tenantId,
        version: operation.version,
        ...updates,
      })) as Operation;

      if (mutationSession !== operationLoadSessionRef.current) {
        return;
      }

      setOperations((currentOperations) =>
        currentOperations.map((currentOperation) =>
          currentOperation.id === updatedOperation.id ? updatedOperation : currentOperation,
        ),
      );
      setScheduleDates((currentScheduleDates) => ({
        ...currentScheduleDates,
        [updatedOperation.id]: updatedOperation.startDate?.slice(0, 10) ?? '',
      }));
      setEndDateDrafts((currentEndDateDrafts) => ({
        ...currentEndDateDrafts,
        [updatedOperation.id]: updatedOperation.endDate?.slice(0, 10) ?? '',
      }));
      setBlockedReasonDrafts((currentBlockedReasonDrafts) => ({
        ...currentBlockedReasonDrafts,
        [updatedOperation.id]: updatedOperation.blockedReason ?? '',
      }));
      setTitleDrafts((currentTitleDrafts) => ({
        ...currentTitleDrafts,
        [updatedOperation.id]: updatedOperation.title,
      }));
      setCodeDrafts((currentCodeDrafts) => ({
        ...currentCodeDrafts,
        [updatedOperation.id]: updatedOperation.code,
      }));
      setSortIndexDrafts((currentSortIndexDrafts) => ({
        ...currentSortIndexDrafts,
        [updatedOperation.id]: String(updatedOperation.sortIndex),
      }));
    } catch (error) {
      if (mutationSession !== operationLoadSessionRef.current) {
        return;
      }

      if (hasForbiddenCode(error)) {
        resetSession(homepageAuthCopy.sessionExpired);
      } else if (extractConflictData(error)) {
        try {
          await loadOperations();

          if (mutationSession !== operationLoadSessionRef.current) {
            return;
          }

          setBoardMessage(homepageAuthCopy.boardConflictReloaded);
        } catch {
          if (mutationSession !== operationLoadSessionRef.current) {
            return;
          }

          setBoardMessage(homepageAuthCopy.boardConflictReloadFailed);
        }
      } else {
        setBoardMessage(failureMessage);
      }
    } finally {
      if (mutationSession !== operationLoadSessionRef.current) {
        return;
      }

      mutatingOperationIdRef.current = null;
      setMutatingOperationId(null);
    }
  };

  const onMoveOperation = async (operation: Operation, bucketLabel: Exclude<BucketFilter, 'ALL'>) => {
    const nextStartDate = toStartDate(bucketLabel);

    if (nextStartDate === operation.startDate) {
      return;
    }

    await onUpdateOperation(operation, { startDate: nextStartDate }, 'Failed to move operation.');
  };

  const onStatusChange = async (operation: Operation, status: Operation['status']) => {
    if (status === operation.status) {
      return;
    }

    await onUpdateOperation(operation, { status }, 'Failed to update operation status.');
  };

  const onScheduleOperation = async (event: FormEvent<HTMLFormElement>, operation: Operation) => {
    event.preventDefault();

    const selectedDate = getScheduledDateValue(operation, scheduleDates);

    if (!isDateBucket(selectedDate)) {
      return;
    }

    await onMoveOperation(operation, selectedDate);
  };

  const onSaveBlockedReason = async (event: FormEvent<HTMLFormElement>, operation: Operation) => {
    event.preventDefault();

    const blockedReason = getBlockedReasonValue(operation, blockedReasonDrafts);

    if (blockedReason === (operation.blockedReason ?? '')) {
      return;
    }

    await onUpdateOperation(operation, { blockedReason }, 'Failed to update blocked reason.');
  };

  const onClearBlockedReason = async (operation: Operation) => {
    if (!operation.blockedReason) {
      return;
    }

    await onUpdateOperation(operation, { blockedReason: null }, 'Failed to update blocked reason.');
  };

  const onSaveTitle = async (event: FormEvent<HTMLFormElement>, operation: Operation) => {
    event.preventDefault();

    const title = getTitleValue(operation, titleDrafts);

    if (title.trim() === '' || title === operation.title) {
      return;
    }

    await onUpdateOperation(operation, { title }, 'Failed to update title.');
  };

  const onSaveCode = async (event: FormEvent<HTMLFormElement>, operation: Operation) => {
    event.preventDefault();

    const code = getCodeValue(operation, codeDrafts);

    if (code.trim() === '' || code === operation.code) {
      return;
    }

    await onUpdateOperation(operation, { code }, 'Failed to update code.');
  };

  const onSaveEndDate = async (event: FormEvent<HTMLFormElement>, operation: Operation) => {
    event.preventDefault();

    const endDate = getEndDateValue(operation, endDateDrafts);

    if (!isDateBucket(endDate) || endDate === operation.endDate?.slice(0, 10)) {
      return;
    }

    await onUpdateOperation(operation, { endDate: `${endDate}T00:00:00.000Z` }, 'Failed to update end date.');
  };

  const onClearEndDate = async (operation: Operation) => {
    if (!operation.endDate) {
      return;
    }

    await onUpdateOperation(operation, { endDate: null }, 'Failed to update end date.');
  };

  const onSaveSortIndex = async (event: FormEvent<HTMLFormElement>, operation: Operation) => {
    event.preventDefault();

    const nextSortIndexValue = getSortIndexValue(operation, sortIndexDrafts).trim();

    if (nextSortIndexValue === '') {
      return;
    }

    const sortIndex = Number(nextSortIndexValue);

    if (!Number.isInteger(sortIndex) || sortIndex === operation.sortIndex) {
      return;
    }

    await onUpdateOperation(operation, { sortIndex }, 'Failed to update sort index.');
  };

  const controlsDisabled = !accessToken;
  const loadOperationsDisabled =
    controlsDisabled || operationLoadState === 'loading' || mutatingOperationId !== null;
  const authOperationDisabled = loginPending || registerPending;
  const homepageAuthCopy = HOMEPAGE_AUTH_LOCALES.en;

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-4 p-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{homepageAuthCopy.boardTitle}</h1>
        <p className="text-sm text-slate-600">{homepageAuthCopy.boardIntro}</p>
      </div>

      {!accessToken ? (
        <div className="grid gap-3 max-w-2xl md:grid-cols-2">
          <form className="flex flex-col gap-2" onSubmit={onLogin}>
            <label className="flex flex-col gap-1">
              {homepageAuthCopy.loginEmailLabel}
              <input
                className="rounded border px-2 py-1"
                value={email}
                disabled={authOperationDisabled}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1">
              {homepageAuthCopy.loginPasswordLabel}
              <input
                className="rounded border px-2 py-1"
                type="password"
                value={password}
                disabled={authOperationDisabled}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>

            <button
              className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
              type="submit"
              disabled={authOperationDisabled}
            >
              {loginPending ? homepageAuthCopy.loginPendingButton : homepageAuthCopy.loginButton}
            </button>
          </form>

          <form className="flex flex-col gap-2" onSubmit={onRegister}>
            <label className="flex flex-col gap-1">
              {homepageAuthCopy.registerEmailLabel}
              <input
                className="rounded border px-2 py-1"
                type="email"
                required
                value={registerEmail}
                disabled={authOperationDisabled}
                onChange={(event) => setRegisterEmail(event.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1">
              {homepageAuthCopy.registerPasswordLabel}
              <input
                className="rounded border px-2 py-1"
                type="password"
                required
                value={registerPassword}
                disabled={authOperationDisabled}
                onChange={(event) => setRegisterPassword(event.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1">
              {homepageAuthCopy.registerCompanyLabel}
              <input
                className="rounded border px-2 py-1"
                required
                value={registerCompanyName}
                disabled={authOperationDisabled}
                onChange={(event) => setRegisterCompanyName(event.target.value)}
              />
            </label>

            <button
              className="rounded border border-slate-400 px-3 py-2 text-slate-900 disabled:opacity-50"
              type="submit"
              disabled={authOperationDisabled}
            >
              {registerPending ? homepageAuthCopy.registerPendingButton : homepageAuthCopy.registerButton}
            </button>
          </form>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <button
          className="rounded border px-3 py-2 disabled:opacity-50"
          type="button"
          disabled={loadOperationsDisabled}
          onClick={onLoadOperations}
        >
          {operationLoadState === 'loading'
            ? homepageAuthCopy.loadingOperationsButton
            : homepageAuthCopy.loadOperationsButton}
        </button>
        {accessToken ? (
          <button
            className="rounded border border-slate-400 px-3 py-2 text-slate-900"
            type="button"
            onClick={() => resetSession()}
          >
            {homepageAuthCopy.logoutResetSessionButton}
          </button>
        ) : null}
      </div>

      {authMessage ? <p>{authMessage}</p> : null}
      {boardMessage ? <p>{boardMessage}</p> : null}

      {accessToken ? (
        <section aria-label={homepageAuthCopy.cashflowSummarySectionLabel} className="rounded border bg-slate-50 p-4">
          <h2 className="text-lg font-medium">{homepageAuthCopy.cashflowSnapshotTitle}</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <div className="rounded border bg-white p-3">
              <p className="text-sm text-slate-500">{homepageAuthCopy.cashflowPlannedIn}</p>
              <p className="text-lg font-semibold">{formatMoney(cashflowSummary.plannedIn, 'CZK')}</p>
            </div>
            <div className="rounded border bg-white p-3">
              <p className="text-sm text-slate-500">{homepageAuthCopy.cashflowActualIn}</p>
              <p className="text-lg font-semibold">{formatMoney(cashflowSummary.actualIn, 'CZK')}</p>
            </div>
            <div className="rounded border bg-white p-3">
              <p className="text-sm text-slate-500">{homepageAuthCopy.invoiceStatusLabel}</p>
              <p className="text-lg font-semibold">
                {invoiceSummary.issuedCount} {homepageAuthCopy.invoiceIssuedSuffix} / {invoiceSummary.paidCount}{' '}
                {homepageAuthCopy.invoicePaidSuffix}
              </p>
              <p className="text-xs text-slate-500">
                {invoiceSummary.totalCount} {homepageAuthCopy.invoicesLoadedSuffix}
              </p>
            </div>
            <div className="rounded border bg-white p-3">
              <p className="text-sm text-slate-500">{homepageAuthCopy.invoiceWorkspaceLabel}</p>
              <Link className="mt-1 inline-block text-sm font-medium text-sky-700 underline" href="/invoices">
                {homepageAuthCopy.openInvoicesWorkspaceLink}
              </Link>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-sm text-slate-600">{homepageAuthCopy.financeSummaryHelper}</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-sm font-medium">{homepageAuthCopy.nextCashflowItemsLabel}</p>
              <div className="flex items-center gap-3">
                <Link className="text-sm font-medium text-sky-700 underline" href="/cashflow">
                  {homepageAuthCopy.openCashflowPageLink}
                </Link>
                <Link className="text-sm font-medium text-sky-700 underline" href="/invoices">
                  {homepageAuthCopy.openInvoicesPageLink}
                </Link>
              </div>
            </div>
            {cashflowSummary.nextItems.length === 0 ? (
              <p className="mt-1 text-sm text-slate-600">{homepageAuthCopy.noCashflowItems}</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {cashflowSummary.nextItems.map((item) => (
                  <li key={item.id}>
                    {item.date.slice(0, 10)} —{' '}
                    {item.kind === 'PLANNED_IN'
                      ? homepageAuthCopy.cashflowPlannedIn
                      : homepageAuthCopy.cashflowActualIn}{' '}
                    — {formatMoney(item.amount, item.currency)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}

      {operationLoadState === 'loading' ? <p>{homepageAuthCopy.loadingOperationsButton}</p> : null}
      {operationLoadState === 'empty' ? <p>{homepageAuthCopy.boardEmpty}</p> : null}
      {operationLoadState === 'forbidden' ? <p>{homepageAuthCopy.boardForbidden}</p> : null}
      {operationLoadState === 'error' ? <p>{homepageAuthCopy.boardLoadFailed}</p> : null}

      {showOperationBoard ? (
        <>
          <div className="flex flex-wrap items-end gap-3 rounded border bg-slate-50 p-4">
            <label className="flex flex-col gap-1 text-sm">
              {homepageAuthCopy.boardFilterQueryLabel}
              <input
                className="rounded border bg-white px-2 py-1"
                type="search"
                value={filters.query}
                onChange={(event) =>
                  setFilters((currentFilters) => ({
                    ...currentFilters,
                    query: event.target.value,
                  }))
                }
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              {homepageAuthCopy.boardFilterStatusLabel}
              <select
                className="rounded border bg-white px-2 py-1"
                value={filters.status}
                onChange={(event) =>
                  setFilters((currentFilters) => ({
                    ...currentFilters,
                    status: event.target.value as BoardFilters['status'],
                  }))
                }
              >
                <option value="ALL">{homepageAuthCopy.commonAllOption}</option>
                {BOARD_STATUS_VALUES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              {homepageAuthCopy.boardFilterBucketLabel}
              <select
                className="rounded border bg-white px-2 py-1"
                value={filters.bucket}
                onChange={(event) =>
                  setFilters((currentFilters) => ({
                    ...currentFilters,
                    bucket: event.target.value as BoardFilters['bucket'],
                  }))
                }
              >
                {availableBucketFilters.map((bucket) => (
                  <option key={bucket} value={bucket}>
                    {bucket === 'ALL' ? homepageAuthCopy.commonAllOption : bucket}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="rounded border px-3 py-2 text-sm"
              type="button"
              onClick={() => setFilters(DEFAULT_BOARD_FILTERS)}
            >
              {homepageAuthCopy.boardFilterResetButton}
            </button>
          </div>

          {showActiveFilterSummary ? (
            <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{boardSummaryShowingText}</p>
                {activeFilters.map((filter) => {
                  const localizedLabel = getActiveFilterLabel(filter.key);

                  return (
                  <span
                    key={filter.key}
                    className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white px-2 py-0.5 text-xs font-medium text-amber-900"
                  >
                    <span>
                      {localizedLabel}: {filter.value}
                    </span>
                    <button
                      className="rounded-full border border-amber-300 px-1 text-[10px] leading-none text-amber-900"
                      type="button"
                      aria-label={homepageAuthCopy.boardFilterClearAriaTemplate.replace('{label}', localizedLabel.toLowerCase())}
                      onClick={() =>
                        setFilters((currentFilters) => clearBoardFilter(currentFilters, filter.key))
                      }
                    >
                      x
                    </button>
                  </span>
                  );
                })}
              </div>
            </div>
          ) : null}

          {isFilteredEmptyState ? (
            <div className="rounded border bg-slate-50 p-4">
              <p className="font-medium">{homepageAuthCopy.boardFilteredEmptyTitle}</p>
              <p className="mt-1 text-sm text-slate-600">{homepageAuthCopy.boardFilteredEmptyHint}</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {operationBuckets.map((bucket) => (
                <section
                  key={bucket.label}
                  aria-label={bucket.label}
                  className="rounded border bg-slate-50 p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="text-lg font-medium">{bucket.label}</h2>
                    <span className="text-sm text-slate-500">{bucket.operations.length}</span>
                  </div>

                  <ul className="space-y-2">
                    {bucket.operations.map((operation) => {
                      const isMutatingOperation = mutatingOperationId === operation.id;
                      const isOperationLocked = mutatingOperationId !== null;
                      const isOtherOperationLocked = isOperationLocked && !isMutatingOperation;
                      const scheduledDateValue = getScheduledDateValue(operation, scheduleDates);
                      const endDateValue = getEndDateValue(operation, endDateDrafts);
                      const blockedReasonValue = getBlockedReasonValue(operation, blockedReasonDrafts);
                      const titleValue = getTitleValue(operation, titleDrafts);
                      const codeValue = getCodeValue(operation, codeDrafts);
                      const sortIndexValue = getSortIndexValue(operation, sortIndexDrafts);
                      const canSaveTitle = titleValue.trim() !== '' && titleValue !== operation.title;
                      const canSaveCode = codeValue.trim() !== '' && codeValue !== operation.code;
                      const canSchedule =
                        isDateBucket(scheduledDateValue) && scheduledDateValue !== operation.startDate?.slice(0, 10);
                      const canSaveEndDate =
                        isDateBucket(endDateValue) && endDateValue !== operation.endDate?.slice(0, 10);
                      const canClearEndDate = operation.endDate !== undefined;
                      const canClearBlockedReason = operation.blockedReason !== undefined;
                      const canSaveBlockedReason = blockedReasonValue !== (operation.blockedReason ?? '');
                      const parsedSortIndex = Number(sortIndexValue.trim());
                      const canSaveSortIndex =
                        sortIndexValue.trim() !== '' &&
                        Number.isInteger(parsedSortIndex) &&
                        parsedSortIndex !== operation.sortIndex;
                      const prerequisiteSummary = formatPrerequisiteSummary(operation);

                      return (
                        <li key={operation.id} className="rounded border bg-white p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-medium">
                              {operation.code} — {operation.title}
                            </div>
                            {prerequisiteSummary ? (
                              <p className="mt-1 text-sm text-amber-700">{prerequisiteSummary}</p>
                            ) : null}
                            {isMutatingOperation ? (
                              <p className="mt-1 text-sm font-medium text-slate-600">Saving…</p>
                            ) : null}
                          </div>
                          {operation.dependencyCount > 0 && !prerequisiteSummary ? (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                              Blocked by {operation.dependencyCount}
                            </span>
                          ) : null}
                        </div>
                        <form
                          className="mt-2 flex items-end gap-2"
                          onSubmit={(event) => void onSaveCode(event, operation)}
                        >
                          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                            Code
                            <input
                              className="rounded border bg-white px-2 py-1"
                              value={codeValue}
                               disabled={isOperationLocked}
                              onChange={(event) =>
                                setCodeDrafts((currentCodeDrafts) => ({
                                  ...currentCodeDrafts,
                                  [operation.id]: event.target.value,
                                }))
                              }
                            />
                          </label>
                          <button
                            className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
                            type="submit"
                             disabled={isOperationLocked || !canSaveCode}
                          >
                            Save code
                          </button>
                        </form>
                        <form
                          className="mt-3 flex items-end gap-2"
                          onSubmit={(event) => void onSaveTitle(event, operation)}
                        >
                          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                            Title
                            <input
                              className="rounded border bg-white px-2 py-1"
                              value={titleValue}
                               disabled={isOperationLocked}
                              onChange={(event) =>
                                setTitleDrafts((currentTitleDrafts) => ({
                                  ...currentTitleDrafts,
                                  [operation.id]: event.target.value,
                                }))
                              }
                            />
                          </label>
                          <button
                            className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
                            type="submit"
                             disabled={isOperationLocked || !canSaveTitle}
                          >
                            Save title
                          </button>
                        </form>
                        <form
                          className="mt-3 flex items-end gap-2"
                          onSubmit={(event) => void onSaveEndDate(event, operation)}
                        >
                          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                            End date
                            <input
                              className="rounded border bg-white px-2 py-1"
                              type="date"
                              value={endDateValue}
                               disabled={isOperationLocked}
                              onChange={(event) =>
                                setEndDateDrafts((currentEndDateDrafts) => ({
                                  ...currentEndDateDrafts,
                                  [operation.id]: event.target.value,
                                }))
                              }
                            />
                          </label>
                          <button
                            className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
                            type="submit"
                             disabled={isOperationLocked || !canSaveEndDate}
                          >
                            Save end
                          </button>
                          {canClearEndDate ? (
                            <button
                              className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
                              type="button"
                               disabled={isOperationLocked}
                              onClick={() => void onClearEndDate(operation)}
                            >
                              Clear end
                            </button>
                          ) : null}
                        </form>
                        <form
                          className="mt-3 flex items-end gap-2"
                          onSubmit={(event) => void onSaveSortIndex(event, operation)}
                        >
                          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                            Sort index
                            <input
                              className="rounded border bg-white px-2 py-1"
                              type="number"
                              inputMode="numeric"
                              value={sortIndexValue}
                               disabled={isOperationLocked}
                              onChange={(event) =>
                                setSortIndexDrafts((currentSortIndexDrafts) => ({
                                  ...currentSortIndexDrafts,
                                  [operation.id]: event.target.value,
                                }))
                              }
                            />
                          </label>
                          <button
                            className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
                            type="submit"
                             disabled={isOperationLocked || !canSaveSortIndex}
                          >
                            Save sort
                          </button>
                        </form>
                        {operation.blockedReason ? (
                          <div className="mt-3 flex items-center gap-2 text-sm text-amber-700">
                            <span className="min-w-0 flex-1">Blocked: {operation.blockedReason}</span>
                            {operation.status !== 'BLOCKED' ? (
                              <button
                                className="rounded border px-3 py-1.5 text-sm text-slate-900 disabled:opacity-50"
                                type="button"
                                 disabled={isOperationLocked}
                                onClick={() => void onClearBlockedReason(operation)}
                              >
                                Clear reason
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                          {operation.status === 'BLOCKED' ? (
                            <form
                              className="mt-3 flex items-end gap-2"
                              onSubmit={(event) => void onSaveBlockedReason(event, operation)}
                            >
                              <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                                Blocked reason
                                <input
                                  className="rounded border bg-white px-2 py-1"
                                  value={blockedReasonValue}
                                   disabled={isOperationLocked}
                                  onChange={(event) =>
                                    setBlockedReasonDrafts((currentBlockedReasonDrafts) => ({
                                      ...currentBlockedReasonDrafts,
                                      [operation.id]: event.target.value,
                                    }))
                                  }
                                />
                              </label>
                              <button
                                className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
                                type="submit"
                                 disabled={isOperationLocked || !canSaveBlockedReason}
                              >
                                Save reason
                              </button>
                              {canClearBlockedReason ? (
                                <button
                                  className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
                                  type="button"
                                   disabled={isOperationLocked}
                                  onClick={() => void onClearBlockedReason(operation)}
                                >
                                  Clear reason
                                </button>
                              ) : null}
                            </form>
                          ) : null}
                          <label className="mt-3 flex flex-col gap-1 text-sm">
                            {homepageAuthCopy.operationCardStatusLabel}
                           <select
                             className="max-w-[11rem] rounded border bg-white px-2 py-1"
                             value={operation.status}
                               disabled={isOperationLocked}
                             onChange={(event) =>
                               void onStatusChange(operation, event.target.value as Operation['status'])
                             }
                           >
                             {BOARD_STATUS_VALUES.map((status) => (
                               <option key={status} value={status}>
                                 {getLocalizedOperationStatusLabel(status)}
                               </option>
                             ))}
                           </select>
                         </label>
                         <label className="mt-3 flex flex-col gap-1 text-sm">
                           Move to bucket
                           <select
                             className="rounded border bg-white px-2 py-1"
                             value={getOperationBucketLabel(operation.startDate)}
                               disabled={isOperationLocked}
                             onChange={(event) =>
                               void onMoveOperation(
                                 operation,
                                event.target.value as Exclude<BucketFilter, 'ALL'>,
                              )
                            }
                          >
                            {moveBucketOptions.map((moveBucket) => (
                              <option key={moveBucket} value={moveBucket}>
                                {moveBucket}
                              </option>
                            ))}
                          </select>
                        </label>
                        <form
                          className="mt-3 flex items-end gap-2"
                          onSubmit={(event) => void onScheduleOperation(event, operation)}
                        >
                          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                            Schedule to date
                            <input
                               className="rounded border bg-white px-2 py-1"
                               type="date"
                               value={scheduledDateValue}
                                 disabled={isOperationLocked}
                               onChange={(event) =>
                                 setScheduleDates((currentScheduleDates) => ({
                                   ...currentScheduleDates,
                                  [operation.id]: event.target.value,
                                }))
                              }
                            />
                          </label>
                          <button
                             className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
                             type="submit"
                               disabled={isOperationLocked || !canSchedule}
                           >
                             Schedule
                           </button>
                        </form>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      ) : null}
    </main>
  );
}
