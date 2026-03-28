"use client";

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
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
import {
  buildDragPlan,
  type BoardOperationForDrag,
} from './board-dnd-plan';
import {
  BoardBucket,
  parseBucketDragId,
  parseOperationDragId,
  SortableOperationItem,
} from './board-dnd';
import { createTrpcClient } from '../lib/trpc/client';
import { resolveSupportedLocale, type SupportedLocale } from '../lib/locale';

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

type OrderSummary = {
  id: string;
  tenantId: string;
  customerId: string;
  code: string;
  title: string;
  status: string;
  dueDate?: string;
  notes?: string;
  version: number;
};

type RoutingTemplate = {
  id: string;
  name: string;
  description: string;
  operations: Array<{
    code: string;
    title: string;
    status: 'READY';
    sortIndex: number;
  }>;
};

type BoardAuditEvent = {
  id: string;
  tenantId: string;
  actorUserId?: string;
  entityType: string;
  entityId: string;
  action: string;
  summary: string;
  createdAt: string;
};

type RecurringCashflowRule = {
  id: string;
  tenantId: string;
  label: string;
  amount: number;
  currency: 'CZK' | 'EUR';
  interval: 'MONTHLY';
  startDate: string;
  nextRunAt: string;
  note?: string;
  status: 'ACTIVE' | 'PAUSED' | 'STOPPED';
  stoppedAt?: string;
  version: number;
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

type BoardColumnConfig = {
  key: string;
  name: string;
  order: number;
  hidden: boolean;
};

type OperationBucket = {
  key: string;
  label: string;
  operations: Operation[];
};

type OperationUpdate = Partial<
  Pick<Operation, 'status' | 'sortIndex' | 'title' | 'code'>
> & {
  startDate?: string | null;
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
  authLoggedIn: string;
  authLoggedOut: string;
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
  routingTemplatesTitle: string;
  routingTemplatesOrderLabel: string;
  routingTemplatesPickerLabel: string;
  routingTemplatesApplyButton: string;
  routingTemplatesEmptyOrders: string;
  routingTemplatesEmptyTemplates: string;
  routingTemplatesAppliedTemplate: string;
  routingTemplatesApplyFailed: string;
  routingTemplatesPreviewLabel: string;
  routingTemplatesLoading: string;
  auditLogTitle: string;
  auditLogOpenButton: string;
  auditLogCloseButton: string;
  auditLogLoading: string;
  auditLogDelayed: string;
  auditLogEmpty: string;
  auditLogLoadFailed: string;
  auditLogRetryButton: string;
  auditLogActorFallback: string;
  auditLogTimestampFallback: string;
  boardColumnsTitle: string;
  boardColumnsOpenButton: string;
  boardColumnsCloseButton: string;
  boardColumnsAddButton: string;
  boardColumnsSaveButton: string;
  boardColumnsSavingButton: string;
  boardColumnsNameLabel: string;
  boardColumnsMoveUpButton: string;
  boardColumnsMoveDownButton: string;
  boardColumnsHideButton: string;
  boardColumnsRemoveButton: string;
  boardColumnsValidationRequired: string;
  boardColumnsValidationUnique: string;
  boardColumnsSaveSuccess: string;
  boardColumnsSaveFailed: string;
  boardColumnsNonEmptyDeleteBlocked: string;
  recurringCashflowTitle: string;
  recurringCashflowCreateButton: string;
  recurringCashflowEmpty: string;
  recurringCashflowLabelField: string;
  recurringCashflowAmountField: string;
  recurringCashflowStartDateField: string;
  recurringCashflowNoteField: string;
  recurringCashflowPauseButton: string;
  recurringCashflowResumeButton: string;
  recurringCashflowStopButton: string;
  recurringCashflowSaveButton: string;
  recurringCashflowLoadFailed: string;
  recurringCashflowSaveFailed: string;
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
  commonBacklogOption: string;
  operationStatusReady: string;
  operationStatusInProgress: string;
  operationStatusDone: string;
  operationStatusBlocked: string;
  operationCardStatusLabel: string;
  operationBlockedByTemplate: string;
  operationBlockedReasonPrefix: string;
  operationClearReasonButton: string;
  operationBlockedReasonLabel: string;
  operationSaveReasonButton: string;
  operationMoveToBucketLabel: string;
  operationScheduleToDateLabel: string;
  operationScheduleButton: string;
  operationSavingLabel: string;
  operationDragHandleLabel: string;
  operationCodeLabel: string;
  operationSaveCodeButton: string;
  operationTitleLabel: string;
  operationSaveTitleButton: string;
  operationSortIndexLabel: string;
  operationSaveSortButton: string;
  operationPrerequisiteSummaryTemplate: string;
  operationPrerequisiteOverflowTemplate: string;
  operationDependenciesLabel: string;
  operationDependencyAddLabel: string;
  operationDependencyAddButton: string;
  operationDependencyRemoveButton: string;
  operationDependencyNone: string;
  operationDependencyUpdateFailed: string;
  operationMoveSuccess: string;
  operationMoveFailed: string;
  operationUpdateStatusFailed: string;
  operationUpdateBlockedReasonFailed: string;
  operationUpdateTitleFailed: string;
  operationUpdateCodeFailed: string;
  operationUpdateEndDateFailed: string;
  operationUpdateSortIndexFailed: string;
  operationEndDateLabel: string;
  operationSaveEndButton: string;
  operationClearEndButton: string;
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
    authLoggedIn: 'Přihlášeno',
    authLoggedOut: 'Odhlášeno',
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
    cashflowSummarySectionLabel: 'Přehled peněžního toku',
    cashflowSnapshotTitle: 'Přehled peněžního toku',
    routingTemplatesTitle: 'Šablony postupů',
    routingTemplatesOrderLabel: 'Zakázka',
    routingTemplatesPickerLabel: 'Šablona',
    routingTemplatesApplyButton: 'Použít šablonu',
    routingTemplatesEmptyOrders: 'Nejsou dostupné žádné zakázky pro použití šablony.',
    routingTemplatesEmptyTemplates: 'Žádné šablony nejsou dostupné.',
    routingTemplatesAppliedTemplate: 'Šablona byla přidána do zakázky.',
    routingTemplatesApplyFailed: 'Použití šablony se nepodařilo.',
    routingTemplatesPreviewLabel: 'Náhled operací',
    routingTemplatesLoading: 'Načítání šablon…',
    auditLogTitle: 'Audit boardu',
    auditLogOpenButton: 'Otevřít audit',
    auditLogCloseButton: 'Zavřít audit',
    auditLogLoading: 'Načítání auditu…',
    auditLogDelayed: 'Načítání trvá déle než obvykle…',
    auditLogEmpty: 'Zatím nejsou dostupné žádné auditní záznamy.',
    auditLogLoadFailed: 'Auditní záznamy se nepodařilo načíst.',
    auditLogRetryButton: 'Zkusit znovu',
    auditLogActorFallback: 'Neznámý aktér',
    auditLogTimestampFallback: 'Neznámý čas',
    boardColumnsTitle: 'Sdílené sloupce boardu',
    boardColumnsOpenButton: 'Upravit sloupce boardu',
    boardColumnsCloseButton: 'Zavřít sloupce boardu',
    boardColumnsAddButton: 'Přidat sloupec',
    boardColumnsSaveButton: 'Uložit sloupce',
    boardColumnsSavingButton: 'Ukládání sloupců…',
    boardColumnsNameLabel: 'Název sloupce',
    boardColumnsMoveUpButton: 'Posunout nahoru',
    boardColumnsMoveDownButton: 'Posunout dolů',
    boardColumnsHideButton: 'Skrýt sloupec',
    boardColumnsRemoveButton: 'Odstranit sloupec',
    boardColumnsValidationRequired: 'Názvy sloupců jsou povinné.',
    boardColumnsValidationUnique: 'Názvy sloupců musí být unikátní.',
    boardColumnsSaveSuccess: 'Sloupce boardu byly uloženy.',
    boardColumnsSaveFailed: 'Sloupce boardu se nepodařilo uložit.',
    boardColumnsNonEmptyDeleteBlocked: 'Neprázdné sloupce nelze skrýt ani odstranit.',
    recurringCashflowTitle: 'Opakovaný cashflow',
    recurringCashflowCreateButton: 'Vytvořit pravidlo',
    recurringCashflowEmpty: 'Zatím nejsou definovaná žádná opakovaná pravidla.',
    recurringCashflowLabelField: 'Název',
    recurringCashflowAmountField: 'Částka',
    recurringCashflowStartDateField: 'Začátek',
    recurringCashflowNoteField: 'Poznámka',
    recurringCashflowPauseButton: 'Pozastavit',
    recurringCashflowResumeButton: 'Obnovit',
    recurringCashflowStopButton: 'Ukončit',
    recurringCashflowSaveButton: 'Uložit změny',
    recurringCashflowLoadFailed: 'Opakovaný cashflow se nepodařilo načíst.',
    recurringCashflowSaveFailed: 'Opakovaný cashflow se nepodařilo uložit.',
    cashflowPlannedIn: 'Plánovaný příjem',
    cashflowActualIn: 'Skutečný příjem',
    invoiceStatusLabel: 'Stav faktur',
    invoiceWorkspaceLabel: 'Fakturační prostor',
    openInvoicesWorkspaceLink: 'Otevřít fakturační prostor',
    financeSummaryHelper:
      'Zkontrolujte zde stav faktur a pak přejděte přímo na dedikované stránky faktur nebo přehledu peněžního toku pro další finanční krok.',
    nextCashflowItemsLabel: 'Další položky peněžního toku',
    openCashflowPageLink: 'Otevřít stránku peněžního toku',
    openInvoicesPageLink: 'Otevřít stránku faktur',
    noCashflowItems: 'Zatím nejsou žádné položky peněžního toku.',
    invoiceIssuedSuffix: 'vystaveno',
    invoicePaidSuffix: 'zaplaceno',
    invoicesLoadedSuffix: 'faktur načteno',
    boardFilterQueryLabel: 'Kód nebo název',
    boardFilterStatusLabel: 'Stav',
    boardFilterBucketLabel: 'Koš podle data',
    boardFilterResetButton: 'Resetovat filtry',
    boardSummaryShowingTemplate: 'Zobrazeno {filtered} z {total} operací.',
    boardFilterBadgeStatusLabel: 'Stav',
    boardFilterBadgeBucketLabel: 'Koš podle data',
    boardFilterBadgeQueryLabel: 'Hledání',
    boardFilterClearAriaTemplate: 'Vymazat filtr {label}',
    boardFilteredEmptyTitle: 'Žádné operace neodpovídají aktuálním filtrům.',
    boardFilteredEmptyHint: 'Vymažte filtry, aby se celá nástěnka vrátila bez opětovného načítání operací.',
    commonAllOption: 'Vše',
    commonBacklogOption: 'Nevyřízené',
    operationStatusReady: 'Připraveno',
    operationStatusInProgress: 'Rozpracováno',
    operationStatusDone: 'Hotovo',
    operationStatusBlocked: 'Blokováno',
    operationCardStatusLabel: 'Stav',
    operationBlockedByTemplate: 'Blokováno {count}',
    operationBlockedReasonPrefix: 'Blokováno:',
    operationClearReasonButton: 'Vymazat důvod',
    operationBlockedReasonLabel: 'Důvod blokace',
    operationSaveReasonButton: 'Uložit důvod',
    operationMoveToBucketLabel: 'Přesunout do koše',
    operationScheduleToDateLabel: 'Naplánovat na datum',
    operationScheduleButton: 'Naplánovat',
    operationSavingLabel: 'Ukládání…',
    operationDragHandleLabel: 'Přetáhnout operaci',
    operationCodeLabel: 'Kód',
    operationSaveCodeButton: 'Uložit kód',
    operationTitleLabel: 'Název',
    operationSaveTitleButton: 'Uložit název',
    operationSortIndexLabel: 'Pořadí',
    operationSaveSortButton: 'Uložit pořadí',
    operationPrerequisiteSummaryTemplate: 'Čeká na {codes}{overflow}',
    operationPrerequisiteOverflowTemplate: ' +{count} dalších',
    operationDependenciesLabel: 'Závislosti',
    operationDependencyAddLabel: 'Přidat závislost',
    operationDependencyAddButton: 'Přidat',
    operationDependencyRemoveButton: 'Odebrat',
    operationDependencyNone: 'Bez závislostí',
    operationDependencyUpdateFailed: 'Uložení závislosti se nepodařilo.',
    operationMoveSuccess: 'Přesun operace byl uložen.',
    operationMoveFailed: 'Přesun operace se nepodařil.',
    operationUpdateStatusFailed: 'Nepodařilo se aktualizovat stav operace.',
    operationUpdateBlockedReasonFailed: 'Nepodařilo se aktualizovat důvod blokace.',
    operationUpdateTitleFailed: 'Nepodařilo se aktualizovat název.',
    operationUpdateCodeFailed: 'Nepodařilo se aktualizovat kód.',
    operationUpdateEndDateFailed: 'Nepodařilo se aktualizovat datum dokončení.',
    operationUpdateSortIndexFailed: 'Nepodařilo se aktualizovat pořadí.',
    operationEndDateLabel: 'Datum dokončení',
    operationSaveEndButton: 'Uložit datum',
    operationClearEndButton: 'Vymazat datum',
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
    authLoggedIn: 'Logged in',
    authLoggedOut: 'Logged out',
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
    routingTemplatesTitle: 'Routing templates',
    routingTemplatesOrderLabel: 'Order',
    routingTemplatesPickerLabel: 'Template',
    routingTemplatesApplyButton: 'Apply template',
    routingTemplatesEmptyOrders: 'No orders available for template apply.',
    routingTemplatesEmptyTemplates: 'No routing templates are available.',
    routingTemplatesAppliedTemplate: 'Template was appended to the order.',
    routingTemplatesApplyFailed: 'Failed to apply routing template.',
    routingTemplatesPreviewLabel: 'Operation preview',
    routingTemplatesLoading: 'Loading templates…',
    auditLogTitle: 'Board audit log',
    auditLogOpenButton: 'Open audit log',
    auditLogCloseButton: 'Close audit log',
    auditLogLoading: 'Loading audit log…',
    auditLogDelayed: 'Loading is taking longer than usual…',
    auditLogEmpty: 'No audit events are available yet.',
    auditLogLoadFailed: 'Failed to load audit events.',
    auditLogRetryButton: 'Retry',
    auditLogActorFallback: 'Unknown actor',
    auditLogTimestampFallback: 'Unknown time',
    boardColumnsTitle: 'Shared board columns',
    boardColumnsOpenButton: 'Edit board columns',
    boardColumnsCloseButton: 'Close board columns',
    boardColumnsAddButton: 'Add column',
    boardColumnsSaveButton: 'Save columns',
    boardColumnsSavingButton: 'Saving columns…',
    boardColumnsNameLabel: 'Column name',
    boardColumnsMoveUpButton: 'Move up',
    boardColumnsMoveDownButton: 'Move down',
    boardColumnsHideButton: 'Hide column',
    boardColumnsRemoveButton: 'Remove column',
    boardColumnsValidationRequired: 'Column names are required.',
    boardColumnsValidationUnique: 'Column names must be unique.',
    boardColumnsSaveSuccess: 'Board columns saved.',
    boardColumnsSaveFailed: 'Failed to save board columns.',
    boardColumnsNonEmptyDeleteBlocked: 'Non-empty columns cannot be hidden or removed.',
    recurringCashflowTitle: 'Recurring cashflow',
    recurringCashflowCreateButton: 'Create rule',
    recurringCashflowEmpty: 'No recurring rules defined yet.',
    recurringCashflowLabelField: 'Label',
    recurringCashflowAmountField: 'Amount',
    recurringCashflowStartDateField: 'Start date',
    recurringCashflowNoteField: 'Note',
    recurringCashflowPauseButton: 'Pause',
    recurringCashflowResumeButton: 'Resume',
    recurringCashflowStopButton: 'Stop',
    recurringCashflowSaveButton: 'Save changes',
    recurringCashflowLoadFailed: 'Failed to load recurring cashflow.',
    recurringCashflowSaveFailed: 'Failed to save recurring cashflow.',
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
    boardFilterResetButton: 'Reset filters',
    boardSummaryShowingTemplate: 'Showing {filtered} of {total} operations.',
    boardFilterBadgeStatusLabel: 'Status',
    boardFilterBadgeBucketLabel: 'Bucket',
    boardFilterBadgeQueryLabel: 'Search',
    boardFilterClearAriaTemplate: 'Clear {label} filter',
    boardFilteredEmptyTitle: 'No operations match the current filters.',
    boardFilteredEmptyHint: 'Reset filters to return to the full board without reloading operations.',
    commonAllOption: 'All',
    commonBacklogOption: 'Backlog',
    operationStatusReady: 'Ready',
    operationStatusInProgress: 'In progress',
    operationStatusDone: 'Done',
    operationStatusBlocked: 'Blocked',
    operationCardStatusLabel: 'Status',
    operationBlockedByTemplate: 'Blocked by {count}',
    operationBlockedReasonPrefix: 'Blocked:',
    operationClearReasonButton: 'Clear reason',
    operationBlockedReasonLabel: 'Blocked reason',
    operationSaveReasonButton: 'Save reason',
    operationMoveToBucketLabel: 'Move to bucket',
    operationScheduleToDateLabel: 'Schedule to date',
    operationScheduleButton: 'Schedule',
    operationSavingLabel: 'Saving…',
    operationDragHandleLabel: 'Drag operation',
    operationCodeLabel: 'Code',
    operationSaveCodeButton: 'Save code',
    operationTitleLabel: 'Title',
    operationSaveTitleButton: 'Save title',
    operationSortIndexLabel: 'Sort index',
    operationSaveSortButton: 'Save sort',
    operationPrerequisiteSummaryTemplate: 'Waiting on {codes}{overflow}',
    operationPrerequisiteOverflowTemplate: ' +{count} more',
    operationDependenciesLabel: 'Dependencies',
    operationDependencyAddLabel: 'Add dependency',
    operationDependencyAddButton: 'Add',
    operationDependencyRemoveButton: 'Remove',
    operationDependencyNone: 'No dependencies',
    operationDependencyUpdateFailed: 'Failed to update dependencies.',
    operationMoveSuccess: 'Operation move saved.',
    operationMoveFailed: 'Failed to move operation.',
    operationUpdateStatusFailed: 'Failed to update operation status.',
    operationUpdateBlockedReasonFailed: 'Failed to update blocked reason.',
    operationUpdateTitleFailed: 'Failed to update title.',
    operationUpdateCodeFailed: 'Failed to update code.',
    operationUpdateEndDateFailed: 'Failed to update end date.',
    operationUpdateSortIndexFailed: 'Failed to update sort index.',
    operationEndDateLabel: 'End date',
    operationSaveEndButton: 'Save end',
    operationClearEndButton: 'Clear end',
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
    authLoggedIn: 'Angemeldet',
    authLoggedOut: 'Abgemeldet',
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
    routingTemplatesTitle: 'Ablaufvorlagen',
    routingTemplatesOrderLabel: 'Auftrag',
    routingTemplatesPickerLabel: 'Vorlage',
    routingTemplatesApplyButton: 'Vorlage anwenden',
    routingTemplatesEmptyOrders: 'Keine Aufträge für die Vorlagenanwendung verfügbar.',
    routingTemplatesEmptyTemplates: 'Keine Ablaufvorlagen verfügbar.',
    routingTemplatesAppliedTemplate: 'Vorlage wurde an den Auftrag angehängt.',
    routingTemplatesApplyFailed: 'Ablaufvorlage konnte nicht angewendet werden.',
    routingTemplatesPreviewLabel: 'Vorgangs-Vorschau',
    routingTemplatesLoading: 'Vorlagen werden geladen…',
    auditLogTitle: 'Board-Auditlog',
    auditLogOpenButton: 'Auditlog öffnen',
    auditLogCloseButton: 'Auditlog schließen',
    auditLogLoading: 'Auditlog wird geladen…',
    auditLogDelayed: 'Das Laden dauert länger als üblich…',
    auditLogEmpty: 'Noch keine Audit-Ereignisse verfügbar.',
    auditLogLoadFailed: 'Audit-Ereignisse konnten nicht geladen werden.',
    auditLogRetryButton: 'Erneut versuchen',
    auditLogActorFallback: 'Unbekannter Akteur',
    auditLogTimestampFallback: 'Unbekannte Zeit',
    boardColumnsTitle: 'Geteilte Board-Spalten',
    boardColumnsOpenButton: 'Board-Spalten bearbeiten',
    boardColumnsCloseButton: 'Board-Spalten schließen',
    boardColumnsAddButton: 'Spalte hinzufügen',
    boardColumnsSaveButton: 'Spalten speichern',
    boardColumnsSavingButton: 'Spalten werden gespeichert…',
    boardColumnsNameLabel: 'Spaltenname',
    boardColumnsMoveUpButton: 'Nach oben',
    boardColumnsMoveDownButton: 'Nach unten',
    boardColumnsHideButton: 'Spalte ausblenden',
    boardColumnsRemoveButton: 'Spalte entfernen',
    boardColumnsValidationRequired: 'Spaltennamen sind erforderlich.',
    boardColumnsValidationUnique: 'Spaltennamen müssen eindeutig sein.',
    boardColumnsSaveSuccess: 'Board-Spalten wurden gespeichert.',
    boardColumnsSaveFailed: 'Board-Spalten konnten nicht gespeichert werden.',
    boardColumnsNonEmptyDeleteBlocked: 'Nicht leere Spalten können nicht ausgeblendet oder entfernt werden.',
    recurringCashflowTitle: 'Wiederkehrender Cashflow',
    recurringCashflowCreateButton: 'Regel erstellen',
    recurringCashflowEmpty: 'Noch keine wiederkehrenden Regeln definiert.',
    recurringCashflowLabelField: 'Name',
    recurringCashflowAmountField: 'Betrag',
    recurringCashflowStartDateField: 'Startdatum',
    recurringCashflowNoteField: 'Notiz',
    recurringCashflowPauseButton: 'Pausieren',
    recurringCashflowResumeButton: 'Fortsetzen',
    recurringCashflowStopButton: 'Beenden',
    recurringCashflowSaveButton: 'Änderungen speichern',
    recurringCashflowLoadFailed: 'Wiederkehrender Cashflow konnte nicht geladen werden.',
    recurringCashflowSaveFailed: 'Wiederkehrender Cashflow konnte nicht gespeichert werden.',
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
    boardFilterBadgeBucketLabel: 'Datums-Bucket',
    boardFilterBadgeQueryLabel: 'Suche',
    boardFilterClearAriaTemplate: 'Filter {label} löschen',
    boardFilteredEmptyTitle: 'Keine Vorgänge entsprechen den aktuellen Filtern.',
    boardFilteredEmptyHint: 'Löschen Sie die Filter, um ohne erneutes Laden der Vorgänge zum vollständigen Board zurückzukehren.',
    commonAllOption: 'Alle',
    commonBacklogOption: 'Rückstand',
    operationStatusReady: 'Bereit',
    operationStatusInProgress: 'In Bearbeitung',
    operationStatusDone: 'Erledigt',
    operationStatusBlocked: 'Blockiert',
    operationCardStatusLabel: 'Status',
    operationBlockedByTemplate: 'Blockiert durch {count}',
    operationBlockedReasonPrefix: 'Blockiert:',
    operationClearReasonButton: 'Grund löschen',
    operationBlockedReasonLabel: 'Sperrgrund',
    operationSaveReasonButton: 'Grund speichern',
    operationMoveToBucketLabel: 'In Bucket verschieben',
    operationScheduleToDateLabel: 'Für Datum planen',
    operationScheduleButton: 'Planen',
    operationSavingLabel: 'Speichern…',
    operationDragHandleLabel: 'Vorgang ziehen',
    operationCodeLabel: 'Code',
    operationSaveCodeButton: 'Code speichern',
    operationTitleLabel: 'Titel',
    operationSaveTitleButton: 'Titel speichern',
    operationSortIndexLabel: 'Sortierindex',
    operationSaveSortButton: 'Sortierung speichern',
    operationPrerequisiteSummaryTemplate: 'Wartet auf {codes}{overflow}',
    operationPrerequisiteOverflowTemplate: ' +{count} weitere',
    operationDependenciesLabel: 'Abhängigkeiten',
    operationDependencyAddLabel: 'Abhängigkeit hinzufügen',
    operationDependencyAddButton: 'Hinzufügen',
    operationDependencyRemoveButton: 'Entfernen',
    operationDependencyNone: 'Keine Abhängigkeiten',
    operationDependencyUpdateFailed: 'Abhängigkeiten konnten nicht gespeichert werden.',
    operationMoveSuccess: 'Vorgangsverschiebung wurde gespeichert.',
    operationMoveFailed: 'Vorgang konnte nicht verschoben werden.',
    operationUpdateStatusFailed: 'Vorgangsstatus konnte nicht aktualisiert werden.',
    operationUpdateBlockedReasonFailed: 'Sperrgrund konnte nicht aktualisiert werden.',
    operationUpdateTitleFailed: 'Titel konnte nicht aktualisiert werden.',
    operationUpdateCodeFailed: 'Code konnte nicht aktualisiert werden.',
    operationUpdateEndDateFailed: 'Enddatum konnte nicht aktualisiert werden.',
    operationUpdateSortIndexFailed: 'Sortierindex konnte nicht aktualisiert werden.',
    operationEndDateLabel: 'Enddatum',
    operationSaveEndButton: 'Enddatum speichern',
    operationClearEndButton: 'Enddatum löschen',
  },
};

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

const getOperationBucketKey = (operation: Pick<Operation, 'startDate'>) =>
  getOperationBucketLabel(operation.startDate);

const mergeBoardColumns = (
  operations: Operation[],
  boardColumns: BoardColumnConfig[],
): BoardColumnConfig[] => {
  const operationKeys = Array.from(new Set(operations.map((operation) => getOperationBucketKey(operation))));
  const columnMap = new Map(boardColumns.map((column) => [column.key, column]));
  const merged = [...boardColumns]
    .sort((left, right) => left.order - right.order || left.key.localeCompare(right.key))
    .map((column, index) => ({ ...column, order: index }));

  for (const key of operationKeys.sort(compareBucketLabels)) {
    if (!columnMap.has(key)) {
      merged.push({
        key,
        name: key,
        order: merged.length,
        hidden: false,
      });
    }
  }

  return merged.map((column, index) => ({ ...column, order: index }));
};

const buildBuckets = (
  operations: Operation[],
  boardColumns: BoardColumnConfig[],
): OperationBucket[] => {
  const mergedColumns = mergeBoardColumns(operations, boardColumns);
  const explicitColumnKeys = new Set(boardColumns.map((column) => column.key));
  const bucketMap = new Map<string, Operation[]>();

  for (const operation of operations) {
    const bucketKey = getOperationBucketKey(operation);
    const bucketOperations = bucketMap.get(bucketKey) ?? [];
    bucketOperations.push(operation);
    bucketMap.set(bucketKey, bucketOperations);
  }

  return mergedColumns
    .filter((column) => {
      const count = bucketMap.get(column.key)?.length ?? 0;
      return count > 0 || (explicitColumnKeys.has(column.key) && !column.hidden);
    })
    .map((column) => ({
      key: column.key,
      label: column.name,
      operations: [...(bucketMap.get(column.key) ?? [])].sort(compareOperations),
    }));
};

const toStartDate = (bucketLabel: BucketFilter) =>
  bucketLabel === BACKLOG_BUCKET ? null : `${bucketLabel}T00:00:00.000Z`;

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

const formatPrerequisiteSummary = (
  operation: Operation,
  homepageAuthCopy: HomepageAuthLocaleStrings,
) => {
  if (!operation.prerequisiteCodes || operation.prerequisiteCodes.length === 0) {
    return null;
  }

  const overflowCount = operation.prerequisiteOverflowCount ?? 0;
  const overflowSuffix =
    overflowCount > 0
      ? homepageAuthCopy.operationPrerequisiteOverflowTemplate.replace(
          '{count}',
          String(overflowCount),
        )
      : '';

  return homepageAuthCopy.operationPrerequisiteSummaryTemplate
    .replace('{codes}', operation.prerequisiteCodes.join(', '))
    .replace('{overflow}', overflowSuffix);
};

const HOMEPAGE_NUMBER_FORMAT_LOCALES: Record<SupportedLocale, string> = {
  cs: 'cs-CZ',
  en: 'en-US',
  de: 'de-DE',
};

const formatMoney = (
  amount: number,
  currency: CashflowItem['currency'],
  locale: SupportedLocale = 'en',
) =>
  new Intl.NumberFormat(HOMEPAGE_NUMBER_FORMAT_LOCALES[locale] ?? HOMEPAGE_NUMBER_FORMAT_LOCALES.en, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);


const formatDateForDisplay = (value: string, locale: SupportedLocale = 'en') => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return new Intl.DateTimeFormat(HOMEPAGE_NUMBER_FORMAT_LOCALES[locale] ?? HOMEPAGE_NUMBER_FORMAT_LOCALES.en, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC',
  }).format(date);
};

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
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [routingTemplates, setRoutingTemplates] = useState<RoutingTemplate[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [auditLogOpen, setAuditLogOpen] = useState(false);
  const [auditLogLoading, setAuditLogLoading] = useState(false);
  const [auditLogDelayed, setAuditLogDelayed] = useState(false);
  const [auditLogLoadedOnce, setAuditLogLoadedOnce] = useState(false);
  const [auditLogError, setAuditLogError] = useState('');
  const [auditLogEvents, setAuditLogEvents] = useState<BoardAuditEvent[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringCashflowRule[]>([]);
  const [recurringLabel, setRecurringLabel] = useState('');
  const [recurringAmount, setRecurringAmount] = useState('');
  const [recurringStartDate, setRecurringStartDate] = useState('');
  const [recurringNote, setRecurringNote] = useState('');
  const [cashflowItems, setCashflowItems] = useState<CashflowItem[]>([]);
  const [invoiceSummaries, setInvoiceSummaries] = useState<InvoiceSummary[]>([]);
  const [authMessage, setAuthMessage] = useState('');
  const [boardMessage, setBoardMessage] = useState('');
  const [boardColumns, setBoardColumns] = useState<BoardColumnConfig[]>([]);
  const [boardColumnsDraft, setBoardColumnsDraft] = useState<BoardColumnConfig[]>([]);
  const [boardColumnsOpen, setBoardColumnsOpen] = useState(false);
  const [boardColumnsSaving, setBoardColumnsSaving] = useState(false);
  const [boardColumnsError, setBoardColumnsError] = useState('');
  const [operationLoadState, setOperationLoadState] = useState<LoadState>('idle');
  const [mutatingOperationId, setMutatingOperationId] = useState<string | null>(null);
  const [scheduleDates, setScheduleDates] = useState<Record<string, string>>({});
  const [endDateDrafts, setEndDateDrafts] = useState<Record<string, string>>({});
  const [blockedReasonDrafts, setBlockedReasonDrafts] = useState<Record<string, string>>({});
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});
  const [codeDrafts, setCodeDrafts] = useState<Record<string, string>>({});
  const [sortIndexDrafts, setSortIndexDrafts] = useState<Record<string, string>>({});
  const [dependencySelections, setDependencySelections] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<BoardFilters>(defaultBoardFilters);
  const hydrationAutoLoadPendingRef = useRef(false);
  const loginPendingRef = useRef(false);
  const registerPendingRef = useRef(false);
  const manualOperationLoadPendingRef = useRef(false);
  const mutatingOperationIdRef = useRef<string | null>(null);
  const operationLoadSessionRef = useRef(0);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const homepageLocale = resolveSupportedLocale();
  const homepageAuthCopy = HOMEPAGE_AUTH_LOCALES[homepageLocale];

  const completeAuthSession = (nextAccessToken: string) => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, nextAccessToken);
    setAccessToken(nextAccessToken);
    resetOperationsState();
    setAuthMessage(homepageAuthCopy.authLoggedIn);

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
  const operationBuckets = useMemo(
    () => buildBuckets(filteredOperations, boardColumns),
    [filteredOperations, boardColumns],
  );
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
  const boardSummaryShowingText = homepageAuthCopy.boardSummaryShowingTemplate
    .replace('{filtered}', String(filteredOperations.length))
    .replace('{total}', String(operations.length));
  const getConfiguredBoardColumn = (bucket: string) =>
    boardColumns.find((column) => column.key === bucket) ?? null;
  const getConfiguredBucketName = (bucket: string) => {
    const configuredColumn = getConfiguredBoardColumn(bucket);

    if (configuredColumn && configuredColumn.name !== bucket) {
      return configuredColumn.name;
    }

    return bucket === BACKLOG_BUCKET ? homepageAuthCopy.commonBacklogOption : bucket;
  };
  const getLocalizedBucketLabel = (bucket: string) => getConfiguredBucketName(bucket);
  const getLocalizedBucketOptionLabel = (bucket: string) => getConfiguredBucketName(bucket);
  const getActiveFilterLabel = (key: (typeof activeFilters)[number]['key']) => {
    switch (key) {
      case 'status':
        return homepageAuthCopy.boardFilterBadgeStatusLabel;
      case 'bucket':
        return homepageAuthCopy.boardFilterBadgeBucketLabel;
      case 'query':
        return homepageAuthCopy.boardFilterBadgeQueryLabel;
      default:
        return key;
    }
  };
  const getLocalizedOperationStatusLabel = (status: Operation['status']) => {
    switch (status) {
      case 'READY':
        return homepageAuthCopy.operationStatusReady;
      case 'IN_PROGRESS':
        return homepageAuthCopy.operationStatusInProgress;
      case 'DONE':
        return homepageAuthCopy.operationStatusDone;
      case 'BLOCKED':
        return homepageAuthCopy.operationStatusBlocked;
      default:
        return status;
    }
  };
  const getClearFilterAriaLabelToken = (filter: (typeof activeFilters)[number], label: string) => {
    if (homepageLocale === 'en' && filter.key === 'bucket') {
      return 'date bucket';
    }

    if (homepageLocale === 'en' && filter.key === 'status') {
      return 'operation status';
    }

    if (homepageLocale === 'en' && filter.key === 'query') {
      return 'code or title query';
    }

    return homepageLocale === 'en' ? label : label.toLowerCase();
  };
  const getLocalizedActiveFilterValue = (filter: (typeof activeFilters)[number]) => {
    if (filter.key === 'status') {
      return getLocalizedOperationStatusLabel(filter.value as Operation['status']);
    }

    if (filter.key === 'bucket') {
      return getLocalizedBucketOptionLabel(filter.value);
    }

    return filter.value;
  };
  const getActiveFilterChipText = (label: string, value: string) =>
    homepageLocale === 'en' ? `${label} — ${value}` : `${label}: ${value}`;

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
    setAuthMessage(homepageAuthCopy.authLoggedIn);
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

  const syncOperationDrafts = (nextOperations: Operation[]) => {
    setScheduleDates(buildScheduleDateDrafts(nextOperations));
    setEndDateDrafts(buildEndDateDrafts(nextOperations));
    setBlockedReasonDrafts(buildBlockedReasonDrafts(nextOperations));
    setTitleDrafts(buildTitleDrafts(nextOperations));
    setCodeDrafts(buildCodeDrafts(nextOperations));
    setSortIndexDrafts(buildSortIndexDrafts(nextOperations));
  };

  const resetOperationsState = () => {
    setOperations([]);
    setOrders([]);
    setRoutingTemplates([]);
    setSelectedOrderId('');
    setSelectedTemplateId('');
    setAuditLogOpen(false);
    setAuditLogLoading(false);
    setAuditLogDelayed(false);
    setAuditLogLoadedOnce(false);
    setAuditLogError('');
    setAuditLogEvents([]);
    setRecurringRules([]);
    setRecurringLabel('');
    setRecurringAmount('');
    setRecurringStartDate('');
    setRecurringNote('');
    setCashflowItems([]);
    setInvoiceSummaries([]);
    setBoardMessage('');
    setBoardColumns([]);
    setBoardColumnsDraft([]);
    setBoardColumnsOpen(false);
    setBoardColumnsSaving(false);
    setBoardColumnsError('');
    mutatingOperationIdRef.current = null;
    setMutatingOperationId(null);
    setScheduleDates({});
    setEndDateDrafts({});
    setBlockedReasonDrafts({});
    setTitleDrafts({});
    setCodeDrafts({});
    setSortIndexDrafts({});
    setDependencySelections({});
    setOperationLoadState('idle');
  };

  const invalidateOperationLoads = () => {
    operationLoadSessionRef.current += 1;
  };

  const resetSession = (message = homepageAuthCopy.authLoggedOut) => {
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
      const [operationResult, orderResult, templateResult, recurringRuleResult, boardColumnResult] = await Promise.all([
        client.operation.list.query(),
        client.order.list.query(),
        client.order.routingTemplates.query(),
        client.cashflow.listRecurringRules.query(),
        client.operation.listBoardColumns.query(),
      ]);
      if (loadSession !== operationLoadSessionRef.current) {
        return [];
      }

      const loadedOperations = operationResult as Operation[];
      const loadedOrders = orderResult as OrderSummary[];
      const loadedTemplates = templateResult as RoutingTemplate[];
      const loadedRecurringRules = recurringRuleResult as RecurringCashflowRule[];
      const loadedBoardColumns = boardColumnResult as BoardColumnConfig[];
      setOperations(loadedOperations);
      setOrders(loadedOrders);
      setRoutingTemplates(loadedTemplates);
      setRecurringRules(loadedRecurringRules);
      setBoardColumns(loadedBoardColumns);
      setBoardColumnsDraft(mergeBoardColumns(loadedOperations, loadedBoardColumns));
      setBoardColumnsError('');
      setSelectedOrderId((current) => current || loadedOrders[0]?.id || '');
      setSelectedTemplateId((current) => current || loadedTemplates[0]?.id || '');
      setBoardMessage('');
      syncOperationDrafts(loadedOperations);
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
        setOrders([]);
        setRoutingTemplates([]);
        setOperationLoadState('error');
      }

      throw error;
    }
  };

  const validateBoardColumnDraft = (columns: BoardColumnConfig[]) => {
    const normalizedNames = columns.map((column) => column.name.trim());

    if (normalizedNames.some((name) => name.length === 0)) {
      return homepageAuthCopy.boardColumnsValidationRequired;
    }

    const uniqueNames = new Set(normalizedNames.map((name) => name.toLocaleLowerCase('en-US')));
    if (uniqueNames.size !== normalizedNames.length) {
      return homepageAuthCopy.boardColumnsValidationUnique;
    }

    return '';
  };

  const onAddBoardColumn = () => {
    setBoardColumnsDraft((currentColumns) => ([
      ...currentColumns,
      {
        key: `custom:${Date.now()}:${currentColumns.length}`,
        name: '',
        order: currentColumns.length,
        hidden: false,
      },
    ]));
    setBoardColumnsError('');
  };

  const onReorderBoardColumn = (index: number, direction: -1 | 1) => {
    setBoardColumnsDraft((currentColumns) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= currentColumns.length) {
        return currentColumns;
      }

      const nextColumns = [...currentColumns];
      const [moved] = nextColumns.splice(index, 1);
      nextColumns.splice(nextIndex, 0, moved);
      return nextColumns.map((column, order) => ({ ...column, order }));
    });
  };

  const onSaveBoardColumns = async () => {
    const normalizedColumns = boardColumnsDraft.map((column, order) => ({
      ...column,
      name: column.name.trim(),
      order,
    }));
    const validationMessage = validateBoardColumnDraft(normalizedColumns);
    if (validationMessage) {
      setBoardColumnsError(validationMessage);
      return;
    }

    setBoardColumnsSaving(true);
    setBoardColumnsError('');

    try {
      const savedColumns = (await trpcClient.operation.saveBoardColumns.mutate({
        columns: normalizedColumns,
      })) as BoardColumnConfig[];
      setBoardColumns(savedColumns);
      setBoardColumnsDraft(mergeBoardColumns(operations, savedColumns));
      setBoardColumnsOpen(false);
      setBoardMessage(homepageAuthCopy.boardColumnsSaveSuccess);
    } catch (error) {
      const message =
        error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof error.message === 'string' &&
        error.message.length > 0
          ? error.message
          : homepageAuthCopy.boardColumnsSaveFailed;
      setBoardColumnsError(message);
    } finally {
      setBoardColumnsSaving(false);
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
      const result = await trpcClient.auth.register.mutate({
        email: registerEmail,
        password: registerPassword,
        companyName: registerCompanyName,
      });
      const nextAccessToken = result.accessToken;
      completeAuthSession(nextAccessToken);
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'data' in error &&
        typeof error.data === 'object' &&
        error.data !== null &&
        'code' in error.data
      ) {
        const code = error.data.code;

        if (code === 'CONFLICT') {
          setAuthMessage(homepageAuthCopy.registrationDuplicateEmail);
        } else if (code === 'TOO_MANY_REQUESTS') {
          setAuthMessage(homepageAuthCopy.registrationRateLimit);
        } else {
          setAuthMessage(homepageAuthCopy.registrationFailure);
        }
      } else {
        setAuthMessage(homepageAuthCopy.registrationFailure);
      }
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
  ): Promise<boolean> => {
    if (mutatingOperationIdRef.current !== null) {
      return false;
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
        return false;
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
      return true;
    } catch (error) {
      if (mutationSession !== operationLoadSessionRef.current) {
        return false;
      }

      if (hasForbiddenCode(error)) {
        resetSession(homepageAuthCopy.sessionExpired);
      } else if (extractConflictData(error)) {
        try {
          await loadOperations();

          if (mutationSession !== operationLoadSessionRef.current) {
            return false;
          }

          setBoardMessage(homepageAuthCopy.boardConflictReloaded);
        } catch {
          if (mutationSession !== operationLoadSessionRef.current) {
            return false;
          }

          setBoardMessage(homepageAuthCopy.boardConflictReloadFailed);
        }
      } else {
        setBoardMessage(failureMessage);
      }

      return false;
    } finally {
      if (mutationSession === operationLoadSessionRef.current) {
        mutatingOperationIdRef.current = null;
        setMutatingOperationId(null);
      }
    }
  };

  const onMoveOperation = async (operation: Operation, bucketLabel: Exclude<BucketFilter, 'ALL'>) => {
    const nextStartDate = toStartDate(bucketLabel);

    if (nextStartDate === operation.startDate) {
      return;
    }

    const result = await onUpdateOperation(
      operation,
      { startDate: nextStartDate },
      homepageAuthCopy.operationMoveFailed,
    );

    if (result) {
      setBoardMessage(homepageAuthCopy.operationMoveSuccess);
    }
  };

  const onDragEnd = async (event: DragEndEvent) => {
    if (mutatingOperationIdRef.current !== null) {
      return;
    }

    const activeId = typeof event.active.id === 'string' ? event.active.id : '';
    const activeOperationId = parseOperationDragId(activeId);
    const overId = typeof event.over?.id === 'string' ? event.over.id : null;

    if (!activeOperationId || !overId) {
      return;
    }

    const overOperationId = parseOperationDragId(overId);
    const overBucketLabel = parseBucketDragId(overId);
    const target = overOperationId
      ? { kind: 'operation' as const, operationId: overOperationId }
      : overBucketLabel
        ? { kind: 'bucket' as const, bucketLabel: overBucketLabel }
        : null;

    if (!target) {
      return;
    }

    const dragPlan = buildDragPlan(operations as BoardOperationForDrag[], activeOperationId, target);
    if (!dragPlan) {
      return;
    }

    const previousOperations = operations;
    const nextOperations = dragPlan.nextOperations as Operation[];
    const operationUpdates = new Map(
      dragPlan.changedOperationIds.map((operationId) => {
        const nextOperation = nextOperations.find((candidate) => candidate.id === operationId);
        return [
          operationId,
          {
            startDate: nextOperation?.startDate,
            sortIndex: nextOperation?.sortIndex,
          },
        ];
      }),
    );

    setBoardMessage('');
    mutatingOperationIdRef.current = activeOperationId;
    setMutatingOperationId(activeOperationId);
    const mutationSession = operationLoadSessionRef.current;
    setOperations(nextOperations);
    syncOperationDrafts(nextOperations);

    try {
      let latestOperations = nextOperations;

      for (const operationId of dragPlan.changedOperationIds) {
        const operation = latestOperations.find((candidate) => candidate.id === operationId);
        const updates = operationUpdates.get(operationId);

        if (!operation || !updates) {
          continue;
        }

        const updatedOperation = (await trpcClient.operation.update.mutate({
          id: operation.id,
          tenantId: operation.tenantId,
          version: operation.version,
          startDate: updates.startDate,
          sortIndex: updates.sortIndex,
        })) as Operation;

        if (mutationSession !== operationLoadSessionRef.current) {
          return;
        }

        latestOperations = latestOperations.map((candidate) =>
          candidate.id === updatedOperation.id ? updatedOperation : candidate,
        );
        setOperations(latestOperations);
      }

      syncOperationDrafts(latestOperations);
      setBoardMessage(homepageAuthCopy.operationMoveSuccess);
    } catch (error) {
      if (mutationSession !== operationLoadSessionRef.current) {
        return;
      }

      setOperations(previousOperations);
      syncOperationDrafts(previousOperations);

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
        try {
          await loadOperations();
        } catch {
          // keep the generic drag failure message below
        }
        setBoardMessage(homepageAuthCopy.operationMoveFailed);
      }
    } finally {
      if (mutationSession !== operationLoadSessionRef.current) {
        return;
      }

      mutatingOperationIdRef.current = null;
      setMutatingOperationId(null);
    }
  };

  const onStatusChange = async (operation: Operation, status: Operation['status']) => {
    if (status === operation.status) {
      return;
    }

    await onUpdateOperation(operation, { status }, homepageAuthCopy.operationUpdateStatusFailed);
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

    await onUpdateOperation(operation, { blockedReason }, homepageAuthCopy.operationUpdateBlockedReasonFailed);
  };

  const onClearBlockedReason = async (operation: Operation) => {
    if (!operation.blockedReason) {
      return;
    }

    await onUpdateOperation(operation, { blockedReason: null }, homepageAuthCopy.operationUpdateBlockedReasonFailed);
  };

  const onSaveTitle = async (event: FormEvent<HTMLFormElement>, operation: Operation) => {
    event.preventDefault();

    const title = getTitleValue(operation, titleDrafts);

    if (title.trim() === '' || title === operation.title) {
      return;
    }

    await onUpdateOperation(operation, { title }, homepageAuthCopy.operationUpdateTitleFailed);
  };

  const onSaveCode = async (event: FormEvent<HTMLFormElement>, operation: Operation) => {
    event.preventDefault();

    const code = getCodeValue(operation, codeDrafts);

    if (code.trim() === '' || code === operation.code) {
      return;
    }

    await onUpdateOperation(operation, { code }, homepageAuthCopy.operationUpdateCodeFailed);
  };

  const onSaveEndDate = async (event: FormEvent<HTMLFormElement>, operation: Operation) => {
    event.preventDefault();

    const endDate = getEndDateValue(operation, endDateDrafts);

    if (!isDateBucket(endDate) || endDate === operation.endDate?.slice(0, 10)) {
      return;
    }

    await onUpdateOperation(
      operation,
      { endDate: `${endDate}T00:00:00.000Z` },
      homepageAuthCopy.operationUpdateEndDateFailed,
    );
  };

  const onClearEndDate = async (operation: Operation) => {
    if (!operation.endDate) {
      return;
    }

    await onUpdateOperation(operation, { endDate: null }, homepageAuthCopy.operationUpdateEndDateFailed);
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

    await onUpdateOperation(
      operation,
      { sortIndex },
      homepageAuthCopy.operationUpdateSortIndexFailed,
    );
  };

  const loadAuditLog = async () => {
    setAuditLogLoading(true);
    setAuditLogDelayed(false);
    setAuditLogError('');

    const delayTimer = window.setTimeout(() => {
      setAuditLogDelayed(true);
    }, 800);

    try {
      const events = await trpcClient.operation.auditLog.query() as BoardAuditEvent[];
      setAuditLogEvents(events);
      setAuditLogLoadedOnce(true);
    } catch (error) {
      if (hasForbiddenCode(error)) {
        resetSession(homepageAuthCopy.sessionExpired);
      } else {
        setAuditLogError(homepageAuthCopy.auditLogLoadFailed);
      }
    } finally {
      window.clearTimeout(delayTimer);
      setAuditLogLoading(false);
    }
  };

  const onCreateRecurringRule = async () => {
    if (!recurringLabel.trim() || !recurringAmount.trim() || !recurringStartDate) {
      return;
    }

    try {
      const created = await trpcClient.cashflow.createRecurringRule.mutate({
        label: recurringLabel.trim(),
        amount: Number(recurringAmount),
        currency: 'CZK',
        interval: 'MONTHLY',
        startDate: `${recurringStartDate}T00:00:00.000Z`,
        note: recurringNote.trim() || undefined,
      }) as RecurringCashflowRule;

      setRecurringRules((current) => [...current, created]);
      setRecurringLabel('');
      setRecurringAmount('');
      setRecurringStartDate('');
      setRecurringNote('');
      setBoardMessage('');
    } catch (error) {
      if (hasForbiddenCode(error)) {
        resetSession(homepageAuthCopy.sessionExpired);
      } else {
        setBoardMessage(homepageAuthCopy.recurringCashflowSaveFailed);
      }
    }
  };

  const onTransitionRecurringRule = async (
    rule: RecurringCashflowRule,
    action: 'pause' | 'resume' | 'stop',
  ) => {
    try {
      const mutate =
        action === 'pause'
          ? trpcClient.cashflow.pauseRecurringRule.mutate
          : action === 'resume'
            ? trpcClient.cashflow.resumeRecurringRule.mutate
            : trpcClient.cashflow.stopRecurringRule.mutate;
      const updated = await mutate({ id: rule.id, version: rule.version }) as RecurringCashflowRule;
      setRecurringRules((current) => current.map((candidate) => candidate.id === updated.id ? updated : candidate));
      setBoardMessage('');
    } catch (error) {
      if (hasForbiddenCode(error)) {
        resetSession(homepageAuthCopy.sessionExpired);
      } else {
        setBoardMessage(homepageAuthCopy.recurringCashflowSaveFailed);
      }
    }
  };

  const onApplyRoutingTemplate = async () => {
    if (!selectedOrderId || !selectedTemplateId) {
      return;
    }

    setBoardMessage('');

    try {
      const result = await trpcClient.order.applyRoutingTemplate.mutate({
        orderId: selectedOrderId,
        templateId: selectedTemplateId,
      }) as { operations: Operation[] };

      setOperations(result.operations);
      syncOperationDrafts(result.operations);
      setOperationLoadState(result.operations.length > 0 ? 'loaded' : 'empty');
      setBoardMessage(homepageAuthCopy.routingTemplatesAppliedTemplate);
    } catch (error) {
      if (hasForbiddenCode(error)) {
        resetSession(homepageAuthCopy.sessionExpired);
      } else if (extractConflictData(error)) {
        await loadOperations().catch(() => undefined);
        setBoardMessage(homepageAuthCopy.boardConflictReloaded);
      } else {
        await loadOperations().catch(() => undefined);
        setBoardMessage(homepageAuthCopy.routingTemplatesApplyFailed);
      }
    }
  };

  const onAddDependency = async (operation: Operation) => {
    const dependsOnId = dependencySelections[operation.id];

    if (!dependsOnId) {
      return;
    }

    setBoardMessage('');

    try {
      const updated = (await trpcClient.operation.addDependency.mutate({
        operationId: operation.id,
        dependsOnId,
      })) as Operation;

      setOperations((currentOperations) =>
        currentOperations.map((candidate) =>
          candidate.id === updated.id ? updated : candidate,
        ),
      );
      setDependencySelections((currentSelections) => ({
        ...currentSelections,
        [operation.id]: '',
      }));
    } catch {
      await loadOperations().catch(() => undefined);
      setBoardMessage(homepageAuthCopy.operationDependencyUpdateFailed);
    }
  };

  const onRemoveDependency = async (operation: Operation, dependsOnCode: string) => {
    const dependsOnOperation = operations.find((candidate) => candidate.code === dependsOnCode);

    if (!dependsOnOperation) {
      setBoardMessage(homepageAuthCopy.operationDependencyUpdateFailed);
      return;
    }

    setBoardMessage('');

    try {
      const updated = (await trpcClient.operation.removeDependency.mutate({
        operationId: operation.id,
        dependsOnId: dependsOnOperation.id,
      })) as Operation;

      setOperations((currentOperations) =>
        currentOperations.map((candidate) =>
          candidate.id === updated.id ? updated : candidate,
        ),
      );
    } catch {
      await loadOperations().catch(() => undefined);
      setBoardMessage(homepageAuthCopy.operationDependencyUpdateFailed);
    }
  };

  const controlsDisabled = !accessToken;
  const loadOperationsDisabled =
    controlsDisabled || operationLoadState === 'loading' || mutatingOperationId !== null;
  const authOperationDisabled = loginPending || registerPending;

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
              className="rounded bg-slate-900 px-3 py-2 text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50"
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
              className="rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-50"
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
          className="rounded bg-slate-900 px-3 py-2 text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50"
          type="button"
          disabled={loadOperationsDisabled}
          onClick={onLoadOperations}
        >
          {operationLoadState === 'loading'
            ? homepageAuthCopy.loadingOperationsButton
            : homepageAuthCopy.loadOperationsButton}
        </button>
        {accessToken ? (
          <>
            <button
              className="rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              type="button"
              onClick={() => {
                setAuditLogOpen(true);
                if (!auditLogLoadedOnce && !auditLogLoading) {
                  void loadAuditLog();
                }
              }}
            >
              {homepageAuthCopy.auditLogOpenButton}
            </button>
            <button
              className="rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              type="button"
              onClick={() => {
                const mergedColumns = mergeBoardColumns(operations, boardColumns);
                setBoardColumnsDraft(mergedColumns);
                setBoardColumnsError('');
                setBoardColumnsOpen(true);
              }}
            >
              {homepageAuthCopy.boardColumnsOpenButton}
            </button>
            <button
              className="rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              type="button"
              onClick={() => resetSession()}
            >
              {homepageAuthCopy.logoutResetSessionButton}
            </button>
          </>
        ) : null}
      </div>

      {authMessage ? <p>{authMessage}</p> : null}
      {boardMessage ? <p>{boardMessage}</p> : null}

      {auditLogOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30">
          <aside className="h-full w-full max-w-xl overflow-y-auto bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{homepageAuthCopy.auditLogTitle}</h2>
              <button
                className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                type="button"
                onClick={() => setAuditLogOpen(false)}
              >
                {homepageAuthCopy.auditLogCloseButton}
              </button>
            </div>
            {auditLogLoading ? (
              <div className="mt-4 space-y-2">
                <p className="text-sm text-slate-600">{homepageAuthCopy.auditLogLoading}</p>
                {auditLogDelayed ? (
                  <p className="text-sm text-amber-700">{homepageAuthCopy.auditLogDelayed}</p>
                ) : null}
              </div>
            ) : auditLogError ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-rose-700">{auditLogError}</p>
                <button
                  className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                  type="button"
                  onClick={() => void loadAuditLog()}
                >
                  {homepageAuthCopy.auditLogRetryButton}
                </button>
              </div>
            ) : auditLogEvents.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">{homepageAuthCopy.auditLogEmpty}</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {auditLogEvents.map((event) => (
                  <li key={event.id} className="rounded border bg-slate-50 p-3">
                    <p className="text-sm font-medium text-slate-900">{event.summary}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {event.actorUserId ?? homepageAuthCopy.auditLogActorFallback} · {event.createdAt ? new Date(event.createdAt).toLocaleString() : homepageAuthCopy.auditLogTimestampFallback}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      ) : null}

      {boardColumnsOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30">
          <aside className="h-full w-full max-w-xl overflow-y-auto bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{homepageAuthCopy.boardColumnsTitle}</h2>
              <button
                className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                type="button"
                onClick={() => setBoardColumnsOpen(false)}
              >
                {homepageAuthCopy.boardColumnsCloseButton}
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {boardColumnsDraft.map((column, index) => (
                <div key={column.key} className="rounded border bg-slate-50 p-3">
                  <label className="flex flex-col gap-1 text-sm">
                    {homepageAuthCopy.boardColumnsNameLabel}
                    <input
                      className="rounded border bg-white px-2 py-1"
                      value={column.name}
                      onChange={(event) => {
                        const nextName = event.target.value;
                        setBoardColumnsDraft((currentColumns) =>
                          currentColumns.map((currentColumn) =>
                            currentColumn.key === column.key
                              ? { ...currentColumn, name: nextName }
                              : currentColumn,
                          ),
                        );
                      }}
                    />
                  </label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                      type="button"
                      disabled={index === 0}
                      onClick={() => onReorderBoardColumn(index, -1)}
                    >
                      {homepageAuthCopy.boardColumnsMoveUpButton}
                    </button>
                    <button
                      className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                      type="button"
                      disabled={index === boardColumnsDraft.length - 1}
                      onClick={() => onReorderBoardColumn(index, 1)}
                    >
                      {homepageAuthCopy.boardColumnsMoveDownButton}
                    </button>
                    <button
                      className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                      type="button"
                      onClick={() => {
                        setBoardColumnsDraft((currentColumns) =>
                          currentColumns.map((currentColumn) =>
                            currentColumn.key === column.key
                              ? { ...currentColumn, hidden: true }
                              : currentColumn,
                          ),
                        );
                      }}
                    >
                      {homepageAuthCopy.boardColumnsHideButton}
                    </button>
                    <button
                      className="rounded border border-rose-300 bg-white px-3 py-2 text-sm text-rose-700"
                      type="button"
                      onClick={() => {
                        setBoardColumnsDraft((currentColumns) =>
                          currentColumns
                            .filter((currentColumn) => currentColumn.key !== column.key)
                            .map((currentColumn, order) => ({ ...currentColumn, order })),
                        );
                      }}
                    >
                      {homepageAuthCopy.boardColumnsRemoveButton}
                    </button>
                  </div>
                </div>
              ))}
              <button
                className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                type="button"
                onClick={onAddBoardColumn}
              >
                {homepageAuthCopy.boardColumnsAddButton}
              </button>
              {boardColumnsError ? <p className="text-sm text-rose-700">{boardColumnsError}</p> : null}
              <button
                className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
                type="button"
                disabled={boardColumnsSaving}
                onClick={() => void onSaveBoardColumns()}
              >
                {boardColumnsSaving
                  ? homepageAuthCopy.boardColumnsSavingButton
                  : homepageAuthCopy.boardColumnsSaveButton}
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {accessToken ? (
        <section className="rounded border bg-slate-50 p-4">
          <h2 className="text-lg font-medium">{homepageAuthCopy.routingTemplatesTitle}</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <label className="flex flex-col gap-1 text-sm">
              {homepageAuthCopy.routingTemplatesOrderLabel}
              <select
                className="rounded border bg-white px-2.5 py-2 text-sm text-slate-900"
                value={selectedOrderId}
                onChange={(event) => setSelectedOrderId(event.target.value)}
                disabled={orders.length === 0}
              >
                {orders.length === 0 ? (
                  <option value="">{homepageAuthCopy.routingTemplatesEmptyOrders}</option>
                ) : (
                  orders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.code} — {order.title}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {homepageAuthCopy.routingTemplatesPickerLabel}
              <select
                className="rounded border bg-white px-2.5 py-2 text-sm text-slate-900"
                value={selectedTemplateId}
                onChange={(event) => setSelectedTemplateId(event.target.value)}
                disabled={routingTemplates.length === 0}
              >
                {routingTemplates.length === 0 ? (
                  <option value="">{homepageAuthCopy.routingTemplatesEmptyTemplates}</option>
                ) : (
                  routingTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))
                )}
              </select>
            </label>
            <button
              className="self-end rounded bg-slate-900 px-3 py-2 text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50"
              type="button"
              disabled={!selectedOrderId || !selectedTemplateId || routingTemplates.length === 0 || orders.length === 0}
              onClick={() => void onApplyRoutingTemplate()}
            >
              {homepageAuthCopy.routingTemplatesApplyButton}
            </button>
          </div>
          <div className="mt-3 rounded border bg-white p-3">
            <p className="text-sm font-medium text-slate-700">{homepageAuthCopy.routingTemplatesPreviewLabel}</p>
            {routingTemplates.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">{homepageAuthCopy.routingTemplatesEmptyTemplates}</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {(routingTemplates.find((template) => template.id === selectedTemplateId)?.operations ?? []).map((operation) => (
                  <li key={`${selectedTemplateId}-${operation.code}`}>
                    {operation.code} — {operation.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}

      {accessToken ? (
        <section className="rounded border bg-slate-50 p-4">
          <h2 className="text-lg font-medium">{homepageAuthCopy.recurringCashflowTitle}</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <label className="flex flex-col gap-1 text-sm">
              {homepageAuthCopy.recurringCashflowLabelField}
              <input className="rounded border bg-white px-2.5 py-2 text-sm text-slate-900" value={recurringLabel} onChange={(event) => setRecurringLabel(event.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {homepageAuthCopy.recurringCashflowAmountField}
              <input className="rounded border bg-white px-2.5 py-2 text-sm text-slate-900" type="number" value={recurringAmount} onChange={(event) => setRecurringAmount(event.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {homepageAuthCopy.recurringCashflowStartDateField}
              <input className="rounded border bg-white px-2.5 py-2 text-sm text-slate-900" type="date" value={recurringStartDate} onChange={(event) => setRecurringStartDate(event.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {homepageAuthCopy.recurringCashflowNoteField}
              <input className="rounded border bg-white px-2.5 py-2 text-sm text-slate-900" value={recurringNote} onChange={(event) => setRecurringNote(event.target.value)} />
            </label>
          </div>
          <div className="mt-3">
            <button className="rounded bg-slate-900 px-3 py-2 text-white" type="button" onClick={() => void onCreateRecurringRule()}>
              {homepageAuthCopy.recurringCashflowCreateButton}
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {recurringRules.length === 0 ? (
              <p className="text-sm text-slate-600">{homepageAuthCopy.recurringCashflowEmpty}</p>
            ) : (
              recurringRules.map((rule) => (
                <div key={rule.id} className="rounded border bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{rule.label}</p>
                      <p className="text-xs text-slate-600">{rule.amount} {rule.currency} · {rule.interval} · next {rule.nextRunAt.slice(0,10)} · {rule.status}</p>
                    </div>
                    <div className="flex gap-2">
                      {rule.status === 'ACTIVE' ? <button className="rounded border px-2 py-1 text-xs" type="button" onClick={() => void onTransitionRecurringRule(rule, 'pause')}>{homepageAuthCopy.recurringCashflowPauseButton}</button> : null}
                      {rule.status === 'PAUSED' ? <button className="rounded border px-2 py-1 text-xs" type="button" onClick={() => void onTransitionRecurringRule(rule, 'resume')}>{homepageAuthCopy.recurringCashflowResumeButton}</button> : null}
                      {rule.status !== 'STOPPED' ? <button className="rounded border px-2 py-1 text-xs" type="button" onClick={() => void onTransitionRecurringRule(rule, 'stop')}>{homepageAuthCopy.recurringCashflowStopButton}</button> : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      {accessToken ? (
        <section aria-label={homepageAuthCopy.cashflowSummarySectionLabel} className="rounded border bg-slate-50 p-4">
          <h2 className="text-lg font-medium">{homepageAuthCopy.cashflowSnapshotTitle}</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <div className="rounded border bg-white p-3">
              <p className="text-sm text-slate-500">{homepageAuthCopy.cashflowPlannedIn}</p>
              <p className="text-lg font-semibold">{formatMoney(cashflowSummary.plannedIn, 'CZK', homepageLocale)}</p>
            </div>
            <div className="rounded border bg-white p-3">
              <p className="text-sm text-slate-500">{homepageAuthCopy.cashflowActualIn}</p>
              <p className="text-lg font-semibold">{formatMoney(cashflowSummary.actualIn, 'CZK', homepageLocale)}</p>
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
                    {formatDateForDisplay(item.date, homepageLocale)} —{' '}
                    {item.kind === 'PLANNED_IN'
                      ? homepageAuthCopy.cashflowPlannedIn
                      : homepageAuthCopy.cashflowActualIn}{' '}
                    — {formatMoney(item.amount, item.currency, homepageLocale)}
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
          <div className="flex flex-wrap items-end gap-3 rounded border bg-slate-50 p-4 md:gap-4 md:p-5">
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              {homepageAuthCopy.boardFilterQueryLabel}
              <input
                className="rounded border bg-white px-2.5 py-1.5 text-sm text-slate-900"
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

            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              {homepageAuthCopy.boardFilterStatusLabel}
              <select
                className="rounded border bg-white px-2.5 py-1.5 text-sm text-slate-900"
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
                    {getLocalizedOperationStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              {homepageAuthCopy.boardFilterBucketLabel}
              <select
                className="rounded border bg-white px-2.5 py-1.5 text-sm text-slate-900"
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
                    {bucket === 'ALL' ? homepageAuthCopy.commonAllOption : getLocalizedBucketOptionLabel(bucket)}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="rounded border bg-white px-3 py-2 text-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 md:ml-auto"
              type="button"
              onClick={() => setFilters(DEFAULT_BOARD_FILTERS)}
            >
              {homepageAuthCopy.boardFilterResetButton}
            </button>
          </div>

          {showActiveFilterSummary ? (
            <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm">
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
                      {getActiveFilterChipText(
                        localizedLabel,
                        getLocalizedActiveFilterValue(filter),
                      )}
                    </span>
                    <button
                      className="rounded-full border border-amber-300 bg-white px-1 text-[10px] leading-none text-amber-900 transition-colors hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                      type="button"
                      aria-label={homepageAuthCopy.boardFilterClearAriaTemplate.replace(
                        '{label}',
                        getClearFilterAriaLabelToken(filter, localizedLabel),
                      )}
                      onClick={() =>
                        setFilters((currentFilters) => clearBoardFilter(currentFilters, filter.key))
                      }
                    >
                      ×
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
            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={(event) => void onDragEnd(event)}>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {operationBuckets.map((bucket) => (
                  <BoardBucket
                    key={bucket.key}
                    bucketLabel={bucket.key}
                    ariaLabel={bucket.label}
                    count={bucket.operations.length}
                    title={bucket.label}
                  >
                    <SortableContext
                      items={bucket.operations.map((operation) => `operation:${operation.id}`)}
                      strategy={verticalListSortingStrategy}
                    >
                      <ul className="space-y-2">
                        {bucket.operations.map((operation) => {
                          const isMutatingOperation = mutatingOperationId === operation.id;
                          const isOperationLocked = mutatingOperationId !== null;
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
                          const prerequisiteSummary = formatPrerequisiteSummary(operation, homepageAuthCopy);

                          return (
                            <SortableOperationItem
                              key={operation.id}
                              operationId={operation.id}
                              bucketLabel={bucket.key}
                            >
                              {({ dragHandleAttributes, dragHandleListeners }) => (
                                <>
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="space-y-1">
                                      <div className="flex items-start gap-2">
                                        <button
                                          className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                                          type="button"
                                          aria-label={homepageAuthCopy.operationDragHandleLabel}
                                          disabled={isOperationLocked}
                                          {...dragHandleAttributes}
                                          {...dragHandleListeners}
                                        >
                                          ⋮⋮
                                        </button>
                                        <div>
                                          <div className="font-semibold leading-5 text-slate-800">
                                            {operation.code} — {operation.title}
                                          </div>
                                          {prerequisiteSummary ? (
                                            <p className="text-sm leading-5 text-amber-700">{prerequisiteSummary}</p>
                                          ) : null}
                                          {isMutatingOperation ? (
                                            <p className="text-sm font-medium text-slate-600">{homepageAuthCopy.operationSavingLabel}</p>
                                          ) : null}
                                        </div>
                                      </div>
                                    </div>
                                    {operation.dependencyCount > 0 && !prerequisiteSummary ? (
                                      <span className="inline-flex items-center rounded-full border border-amber-300/90 bg-amber-100/70 px-3 py-1 text-xs font-semibold tracking-wide text-amber-950 shadow-sm">
                                        {homepageAuthCopy.operationBlockedByTemplate.replace(
                                          '{count}',
                                          String(operation.dependencyCount),
                                        )}
                                      </span>
                                    ) : null}
                                  </div>
                                  <form
                                    className="mt-3 flex items-end gap-3 rounded-md bg-slate-50/60 p-2"
                                    onSubmit={(event) => void onSaveCode(event, operation)}
                                  >
                                    <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                                      {homepageAuthCopy.operationCodeLabel}
                                      <input
                                        className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
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
                                      className="rounded border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:opacity-50"
                                      type="submit"
                                      disabled={isOperationLocked || !canSaveCode}
                                    >
                                      {homepageAuthCopy.operationSaveCodeButton}
                                    </button>
                                  </form>
                                  <form
                                    className="mt-3 flex items-end gap-3 rounded-md bg-slate-50/60 p-2"
                                    onSubmit={(event) => void onSaveTitle(event, operation)}
                                  >
                                    <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                                      {homepageAuthCopy.operationTitleLabel}
                                      <input
                                        className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
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
                                      className="rounded border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:opacity-50"
                                      type="submit"
                                      disabled={isOperationLocked || !canSaveTitle}
                                    >
                                      {homepageAuthCopy.operationSaveTitleButton}
                                    </button>
                                  </form>
                                  <form
                                    className="mt-3 flex items-end gap-3 rounded-md bg-slate-50/60 p-2"
                                    onSubmit={(event) => void onSaveEndDate(event, operation)}
                                  >
                                    <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                                      {homepageAuthCopy.operationEndDateLabel}
                                      <input
                                        className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
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
                                      className="rounded border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:opacity-50"
                                      type="submit"
                                      disabled={isOperationLocked || !canSaveEndDate}
                                    >
                                      {homepageAuthCopy.operationSaveEndButton}
                                    </button>
                                    {canClearEndDate ? (
                                      <button
                                        className="inline-flex items-center rounded border bg-white px-2.5 py-1.5 text-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-50"
                                        type="button"
                                        disabled={isOperationLocked}
                                        onClick={() => void onClearEndDate(operation)}
                                      >
                                        {homepageAuthCopy.operationClearEndButton}
                                      </button>
                                    ) : null}
                                  </form>
                                  <form
                                    className="mt-3 flex items-end gap-3 rounded-md bg-slate-50/60 p-2"
                                    onSubmit={(event) => void onSaveSortIndex(event, operation)}
                                  >
                                    <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                                      {homepageAuthCopy.operationSortIndexLabel}
                                      <input
                                        className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
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
                                      className="rounded border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:opacity-50"
                                      type="submit"
                                      disabled={isOperationLocked || !canSaveSortIndex}
                                    >
                                      {homepageAuthCopy.operationSaveSortButton}
                                    </button>
                                  </form>
                                  {operation.blockedReason ? (
                                    <div className="mt-3 flex items-start gap-2.5 rounded-md border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-sm text-amber-800">
                                      <span className="min-w-0 flex-1 font-medium leading-5">
                                        {homepageAuthCopy.operationBlockedReasonPrefix} {operation.blockedReason}
                                      </span>
                                      {operation.status !== 'BLOCKED' ? (
                                        <button
                                          className="rounded border border-amber-300/90 bg-white px-2.5 py-1 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:opacity-50"
                                          type="button"
                                          disabled={isOperationLocked}
                                          onClick={() => void onClearBlockedReason(operation)}
                                        >
                                          {homepageAuthCopy.operationClearReasonButton}
                                        </button>
                                      ) : null}
                                    </div>
                                  ) : null}
                                  {operation.status === 'BLOCKED' ? (
                                    <form
                                      className="mt-3 flex items-end gap-3 rounded-md border border-amber-200/70 bg-amber-50/50 p-2.5"
                                      onSubmit={(event) => void onSaveBlockedReason(event, operation)}
                                    >
                                      <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium uppercase tracking-wide text-amber-900/80">
                                        {homepageAuthCopy.operationBlockedReasonLabel}
                                        <input
                                          className="rounded border border-amber-300 bg-white px-2 py-1.5 text-sm font-normal normal-case tracking-normal text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
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
                                        className="rounded border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:opacity-50"
                                        type="submit"
                                        disabled={isOperationLocked || !canSaveBlockedReason}
                                      >
                                        {homepageAuthCopy.operationSaveReasonButton}
                                      </button>
                                      {canClearBlockedReason ? (
                                        <button
                                          className="rounded border border-amber-300/90 bg-white px-3 py-1.5 text-sm text-amber-900 transition-colors hover:bg-amber-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:opacity-50"
                                          type="button"
                                          disabled={isOperationLocked}
                                          onClick={() => void onClearBlockedReason(operation)}
                                        >
                                          {homepageAuthCopy.operationClearReasonButton}
                                        </button>
                                      ) : null}
                                    </form>
                                  ) : null}
                                  <div className="mt-3 rounded-lg border border-slate-200/80 bg-slate-50/50 p-2.5">
                                    <div className="text-xs font-medium uppercase tracking-wide text-slate-600">
                                      {homepageAuthCopy.operationDependenciesLabel}
                                    </div>
                                    <div className="mt-2 space-y-2">
                                      {operation.prerequisiteCodes && operation.prerequisiteCodes.length > 0 ? (
                                        operation.prerequisiteCodes.map((code) => (
                                          <div key={code} className="flex items-center justify-between gap-2 rounded border bg-white px-2 py-1.5 text-sm text-slate-800">
                                            <span>{code}</span>
                                            <button
                                              className="rounded border bg-white px-2 py-1 text-xs transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-50"
                                              type="button"
                                              disabled={isOperationLocked}
                                              onClick={() => void onRemoveDependency(operation, code)}
                                            >
                                              {homepageAuthCopy.operationDependencyRemoveButton}
                                            </button>
                                          </div>
                                        ))
                                      ) : (
                                        <p className="text-sm text-slate-600">{homepageAuthCopy.operationDependencyNone}</p>
                                      )}
                                    </div>
                                    <div className="mt-3 flex items-end gap-3">
                                      <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                                        {homepageAuthCopy.operationDependencyAddLabel}
                                        <select
                                          className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                                          value={dependencySelections[operation.id] ?? ''}
                                          disabled={isOperationLocked}
                                          onChange={(event) =>
                                            setDependencySelections((currentSelections) => ({
                                              ...currentSelections,
                                              [operation.id]: event.target.value,
                                            }))
                                          }
                                        >
                                          <option value="">—</option>
                                          {operations
                                            .filter((candidate) => candidate.id !== operation.id)
                                            .filter(
                                              (candidate) => !(operation.prerequisiteCodes ?? []).includes(candidate.code),
                                            )
                                            .map((candidate) => (
                                              <option key={candidate.id} value={candidate.id}>
                                                {candidate.code} ({candidate.title})
                                              </option>
                                            ))}
                                        </select>
                                      </label>
                                      <button
                                        className="rounded border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:opacity-50"
                                        type="button"
                                        disabled={isOperationLocked || !(dependencySelections[operation.id] ?? '')}
                                        onClick={() => void onAddDependency(operation)}
                                      >
                                        {homepageAuthCopy.operationDependencyAddButton}
                                      </button>
                                    </div>
                                  </div>
                                  <div className="mt-3.5 grid gap-2 rounded-lg border border-slate-200/80 bg-slate-50/50 p-2 sm:grid-cols-2">
                                    <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-600">
                                      {homepageAuthCopy.operationCardStatusLabel}
                                      <select
                                        className="max-w-[11rem] rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
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
                                    <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-600">
                                      {homepageAuthCopy.operationMoveToBucketLabel}
                                      <select
                                        className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
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
                                            {getLocalizedBucketOptionLabel(moveBucket)}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                  </div>
                                  <form
                                    className="mt-3 flex items-end gap-2.5 sm:gap-3 rounded-lg border border-slate-200/50 bg-slate-50/40 p-2 sm:p-2.5"
                                    onSubmit={(event) => void onScheduleOperation(event, operation)}
                                  >
                                    <label className="flex min-w-0 flex-1 flex-col justify-end gap-0.5 text-xs font-medium uppercase tracking-wide text-slate-600">
                                      {homepageAuthCopy.operationScheduleToDateLabel}
                                      <input
                                        className="h-9 rounded border border-slate-200/80 bg-white/95 px-2 py-1.5 text-sm font-normal text-slate-700 placeholder:normal-case placeholder:text-[12px] placeholder:leading-[1.1] placeholder:text-slate-500/[0.02] placeholder:font-normal placeholder:tracking-[0em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
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
                                      className="h-9 rounded border border-slate-800 bg-slate-800 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50"
                                      type="submit"
                                      disabled={isOperationLocked || !canSchedule}
                                    >
                                      {homepageAuthCopy.operationScheduleButton}
                                    </button>
                                  </form>
                                </>
                              )}
                            </SortableOperationItem>
                          );
                        })}
                      </ul>
                    </SortableContext>
                  </BoardBucket>
                ))}
              </div>
            </DndContext>
          )}
        </>
      ) : null}
    </main>
  );
}


