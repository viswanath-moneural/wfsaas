'use client'

import { useState, type ReactNode } from 'react'
import Skeleton from './Skeleton'

// ----------------------------------------------------------
// Types
// ----------------------------------------------------------
export interface Column<T = any> {
  key:        string
  header:     string
  width?:     string | number
  minWidth?:  number
  sortable?:  boolean
  align?:     'left' | 'center' | 'right'
  render?:    (value: any, row: T) => ReactNode
}

export interface RowAction<T = any> {
  label:       string
  icon?:       ReactNode
  onClick:     (row: T) => void
  variant?:    'default' | 'danger'
  permission?: string
  hidden?:     (row: T) => boolean
}

export interface BulkAction<T = any> {
  label:   string
  icon?:   ReactNode
  onClick: (rows: T[]) => void
}

export interface PaginationState {
  page:     number
  pageSize: number
  total:    number
}

interface DataTableProps<T = any> {
  columns:      Column<T>[]
  data:         T[]
  rowKey?:      keyof T | ((row: T) => string)
  loading?:     boolean
  pagination?:  PaginationState
  onPageChange?: (page: number) => void
  onSort?:      (key: string, dir: 'asc' | 'desc') => void
  rowActions?:  RowAction<T>[]
  bulkActions?: BulkAction<T>[]
  onRowClick?:  (row: T) => void
  emptyTitle?:  string
  emptyMessage?:string
  searchable?:  boolean
  searchValue?: string
  onSearch?:    (value: string) => void
  searchPlaceholder?: string
  compact?:     boolean
  stickyHeader?:boolean
}

type SortDir = 'asc' | 'desc' | null

// ----------------------------------------------------------
// Component
// ----------------------------------------------------------
export default function DataTable<T extends Record<string, any>>({
  columns,
  data,
  rowKey      = 'id',
  loading     = false,
  pagination,
  onPageChange,
  onSort,
  rowActions  = [],
  bulkActions = [],
  onRowClick,
  emptyTitle   = 'No records found',
  emptyMessage = 'Try adjusting your filters or add a new record.',
  searchable   = false,
  searchValue  = '',
  onSearch,
  searchPlaceholder = 'Search...',
  compact      = false,
  stickyHeader = true,
}: DataTableProps<T>) {
  const [sortKey, setSortKey]     = useState<string | null>(null)
  const [sortDir, setSortDir]     = useState<SortDir>(null)
  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  const getRowKey = (row: T): string => {
    if (typeof rowKey === 'function') return rowKey(row)
    return String(row[rowKey] ?? '')
  }

  const handleSort = (key: string) => {
    const newDir: SortDir =
      sortKey === key ? (sortDir === 'asc' ? 'desc' : sortDir === 'desc' ? null : 'asc') : 'asc'
    setSortKey(newDir ? key : null)
    setSortDir(newDir)
    if (newDir) onSort?.(key, newDir)
  }

  const toggleSelectAll = () => {
    if (selected.size === data.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(data.map(getRowKey)))
    }
  }

  const toggleSelect = (key: string) => {
    const next = new Set(selected)
    next.has(key) ? next.delete(key) : next.add(key)
    setSelected(next)
  }

  const selectedRows = data.filter(r => selected.has(getRowKey(r)))
  const allSelected  = data.length > 0 && selected.size === data.length
  const someSelected = selected.size > 0 && !allSelected
  const hasActions   = rowActions.length > 0

  return (
    <>
      <style>{TABLE_STYLES}</style>
      <div className="dt">

        {/* ---- Toolbar ---- */}
        {(searchable || (bulkActions.length > 0 && selectedRows.length > 0)) && (
          <div className="dt__toolbar">
            {searchable && (
              <div className="dt__search">
                <span className="dt__search-icon" aria-hidden="true">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
                  </svg>
                </span>
                <input
                  type="search"
                  className="dt__search-input"
                  placeholder={searchPlaceholder}
                  value={searchValue}
                  onChange={e => onSearch?.(e.target.value)}
                />
              </div>
            )}
            {selectedRows.length > 0 && bulkActions.length > 0 && (
              <div className="dt__bulk-actions">
                <span className="dt__bulk-count">{selectedRows.length} selected</span>
                {bulkActions.map((action, i) => (
                  <button
                    key={i}
                    className="dt__bulk-btn"
                    onClick={() => { action.onClick(selectedRows); setSelected(new Set()) }}
                  >
                    {action.icon}
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---- Table ---- */}
        <div className="dt__scroll">
          <table className={`dt__table ${compact ? 'dt__table--compact' : ''}`}>
            <thead className={stickyHeader ? 'dt__head--sticky' : ''}>
              <tr>
                {bulkActions.length > 0 && (
                  <th className="dt__th dt__th--check">
                    <input
                      type="checkbox"
                      className="dt__checkbox"
                      checked={allSelected}
                      ref={el => { if (el) el.indeterminate = someSelected }}
                      onChange={toggleSelectAll}
                      aria-label="Select all rows"
                    />
                  </th>
                )}
                {columns.map(col => (
                  <th
                    key={col.key}
                    className={[
                      'dt__th',
                      col.sortable ? 'dt__th--sortable' : '',
                      col.align === 'right'  ? 'dt__th--right'  : '',
                      col.align === 'center' ? 'dt__th--center' : '',
                    ].filter(Boolean).join(' ')}
                    style={{
                      width:    col.width,
                      minWidth: col.minWidth,
                    }}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                    aria-sort={
                      sortKey === col.key
                        ? sortDir === 'asc' ? 'ascending' : 'descending'
                        : undefined
                    }
                  >
                    <span className="dt__th-inner">
                      {col.header}
                      {col.sortable && (
                        <span className="dt__sort-icon" aria-hidden="true">
                          {sortKey === col.key && sortDir === 'asc'  ? '↑' :
                           sortKey === col.key && sortDir === 'desc' ? '↓' : '↕'}
                        </span>
                      )}
                    </span>
                  </th>
                ))}
                {hasActions && <th className="dt__th dt__th--actions"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="dt__row">
                    {bulkActions.length > 0 && <td className="dt__td dt__td--check"><Skeleton height={14} width={14} radius="sm" /></td>}
                    {columns.map(col => (
                      <td key={col.key} className="dt__td">
                        <Skeleton height={14} width={col.key === columns[0].key ? 120 : '70%'} />
                      </td>
                    ))}
                    {hasActions && <td className="dt__td dt__td--actions" />}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (bulkActions.length > 0 ? 1 : 0) + (hasActions ? 1 : 0)}
                    className="dt__empty"
                  >
                    <div className="dt__empty-inner">
                      <span className="dt__empty-icon" aria-hidden="true">
                        <svg viewBox="0 0 48 48" fill="none">
                          <rect width="48" height="48" rx="12" fill="var(--color-gray-100)"/>
                          <path d="M14 24h20M14 16h20M14 32h12" stroke="var(--color-gray-400)" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      </span>
                      <p className="dt__empty-title">{emptyTitle}</p>
                      <p className="dt__empty-message">{emptyMessage}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                data.map(row => {
                  const key = getRowKey(row)
                  const isSelected = selected.has(key)
                  return (
                    <tr
                      key={key}
                      className={[
                        'dt__row',
                        isSelected  ? 'dt__row--selected'  : '',
                        onRowClick  ? 'dt__row--clickable' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                    >
                      {bulkActions.length > 0 && (
                        <td className="dt__td dt__td--check" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="dt__checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(key)}
                            aria-label={`Select row ${key}`}
                          />
                        </td>
                      )}
                      {columns.map(col => (
                        <td
                          key={col.key}
                          className={[
                            'dt__td',
                            col.align === 'right'  ? 'dt__td--right'  : '',
                            col.align === 'center' ? 'dt__td--center' : '',
                          ].filter(Boolean).join(' ')}
                        >
                          {col.render
                            ? col.render(row[col.key], row)
                            : <span className="dt__cell-text">{row[col.key] ?? '—'}</span>
                          }
                        </td>
                      ))}
                      {hasActions && (
                        <td className="dt__td dt__td--actions" onClick={e => e.stopPropagation()}>
                          <div className="dt__action-menu">
                            <button
                              className="dt__action-trigger"
                              onClick={() => setMenuOpenId(menuOpenId === key ? null : key)}
                              aria-label="Row actions"
                              aria-expanded={menuOpenId === key}
                            >
                              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
                              </svg>
                            </button>
                            {menuOpenId === key && (
                              <>
                                <div className="dt__menu-backdrop" onClick={() => setMenuOpenId(null)} />
                                <div className="dt__menu" role="menu">
                                  {rowActions
                                    .filter(a => !a.hidden?.(row))
                                    .map((action, i) => (
                                      <button
                                        key={i}
                                        className={`dt__menu-item ${action.variant === 'danger' ? 'dt__menu-item--danger' : ''}`}
                                        role="menuitem"
                                        onClick={() => { action.onClick(row); setMenuOpenId(null) }}
                                      >
                                        {action.icon && <span className="dt__menu-icon" aria-hidden="true">{action.icon}</span>}
                                        {action.label}
                                      </button>
                                    ))
                                  }
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ---- Pagination ---- */}
        {pagination && (
          <div className="dt__pagination">
            <span className="dt__pagination-info">
              Showing {Math.min((pagination.page - 1) * pagination.pageSize + 1, pagination.total)}–
              {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
            </span>
            <div className="dt__pagination-nav">
              <button
                className="dt__page-btn"
                onClick={() => onPageChange?.(pagination.page - 1)}
                disabled={pagination.page <= 1}
                aria-label="Previous page"
              >
                ‹
              </button>
              {Array.from({ length: Math.ceil(pagination.total / pagination.pageSize) }, (_, i) => i + 1)
                .filter(p => Math.abs(p - pagination.page) <= 2)
                .map(p => (
                  <button
                    key={p}
                    className={`dt__page-btn ${p === pagination.page ? 'dt__page-btn--active' : ''}`}
                    onClick={() => onPageChange?.(p)}
                    aria-current={p === pagination.page ? 'page' : undefined}
                  >
                    {p}
                  </button>
                ))
              }
              <button
                className="dt__page-btn"
                onClick={() => onPageChange?.(pagination.page + 1)}
                disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)}
                aria-label="Next page"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

const TABLE_STYLES = `
/* ---- Wrapper ---- */
.dt {
  display:        flex;
  flex-direction: column;
  background:     var(--surface-card);
  border:         1px solid var(--border-default);
  border-radius:  var(--radius-lg);
  overflow:       hidden;
}

/* ---- Toolbar ---- */
.dt__toolbar {
  display:         flex;
  align-items:     center;
  gap:             var(--space-3);
  padding:         var(--space-3) var(--space-4);
  border-bottom:   1px solid var(--border-default);
  background:      var(--surface-card);
  flex-wrap:       wrap;
}

.dt__search {
  position:    relative;
  flex:        1;
  min-width:   200px;
  max-width:   320px;
}
.dt__search-icon {
  position:    absolute;
  left:        10px;
  top:         50%;
  transform:   translateY(-50%);
  color:       var(--text-tertiary);
  pointer-events: none;
}
.dt__search-icon svg { width: 15px; height: 15px; }
.dt__search-input {
  width:        100%;
  height:       32px;
  padding:      0 var(--space-3) 0 34px;
  font-size:    var(--text-sm);
  border:       1px solid var(--border-default);
  border-radius:var(--radius-md);
  background:   var(--surface-input);
  outline:      none;
  color:        var(--text-primary);
  transition:   border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.dt__search-input:focus {
  border-color: var(--border-focus);
  box-shadow:   var(--shadow-focus);
}

.dt__bulk-actions {
  display:     flex;
  align-items: center;
  gap:         var(--space-2);
  margin-left: auto;
}
.dt__bulk-count {
  font-size:   var(--text-sm);
  font-weight: var(--font-medium);
  color:       var(--color-primary-600);
}
.dt__bulk-btn {
  display:      flex;
  align-items:  center;
  gap:          var(--space-1);
  height:       32px;
  padding:      0 var(--space-3);
  font-size:    var(--text-sm);
  font-weight:  var(--font-medium);
  font-family:  var(--font-sans);
  color:        var(--text-primary);
  background:   var(--color-gray-100);
  border:       1px solid var(--border-default);
  border-radius:var(--radius-md);
  cursor:       pointer;
  transition:   background var(--transition-fast);
}
.dt__bulk-btn:hover { background: var(--color-gray-200); }

/* ---- Table scroll ---- */
.dt__scroll {
  overflow-x: auto;
  overflow-y: visible;
  -webkit-overflow-scrolling: touch;
}

/* ---- Table ---- */
.dt__table {
  width:           100%;
  border-collapse: collapse;
  table-layout:    auto;
}

.dt__head--sticky thead,
.dt__table .dt__head--sticky {
  position: sticky;
  top:      0;
  z-index:  var(--z-raised);
}

/* ---- Header ---- */
.dt__th {
  padding:        var(--table-cell-py) var(--table-cell-px);
  font-size:      var(--table-header-font-size);
  font-weight:    var(--font-semibold);
  color:          var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  background:     var(--surface-table-header);
  border-bottom:  1px solid var(--border-default);
  white-space:    nowrap;
}

.dt__th--sortable {
  cursor:          pointer;
  user-select:     none;
}
.dt__th--sortable:hover { color: var(--text-primary); }

.dt__th--right  { text-align: right; }
.dt__th--center { text-align: center; }
.dt__th--check  { width: 40px; padding-right: 0; }
.dt__th--actions { width: 48px; }

.dt__th-inner {
  display:     inline-flex;
  align-items: center;
  gap:         var(--space-1);
}
.dt__sort-icon {
  font-size:   10px;
  color:       var(--text-tertiary);
}

/* ---- Body ---- */
.dt__row {
  border-bottom: 1px solid var(--border-default);
  transition:    background var(--transition-fast);
}
.dt__row:last-child { border-bottom: none; }
.dt__row:hover      { background: var(--surface-table-row-hover); }
.dt__row--selected  { background: var(--color-primary-50); }
.dt__row--clickable { cursor: pointer; }

.dt__td {
  padding:   var(--table-cell-py) var(--table-cell-px);
  font-size: var(--table-font-size);
  color:     var(--text-primary);
  vertical-align: middle;
}
.dt__td--right  { text-align: right; }
.dt__td--center { text-align: center; }
.dt__td--check  { width: 40px; padding-right: 0; }
.dt__td--actions{ width: 48px; }

.dt__cell-text {
  display:         block;
  overflow:        hidden;
  text-overflow:   ellipsis;
  white-space:     nowrap;
  max-width:       280px;
}

/* Compact mode */
.dt__table--compact .dt__th,
.dt__table--compact .dt__td {
  padding-top:    6px;
  padding-bottom: 6px;
}

/* ---- Checkbox ---- */
.dt__checkbox {
  width:        16px;
  height:       16px;
  cursor:       pointer;
  accent-color: var(--color-primary-600);
  border-radius:var(--radius-sm);
}

/* ---- Row actions ---- */
.dt__action-menu {
  position:    relative;
  display:     flex;
  justify-content: center;
}
.dt__action-trigger {
  display:      flex;
  align-items:  center;
  justify-content: center;
  width:        32px;
  height:       32px;
  border:       none;
  background:   none;
  color:        var(--text-tertiary);
  border-radius:var(--radius-md);
  cursor:       pointer;
  transition:   background var(--transition-fast), color var(--transition-fast);
}
.dt__action-trigger:hover {
  background: var(--color-gray-100);
  color:      var(--text-primary);
}
.dt__action-trigger svg { width: 16px; height: 16px; }

.dt__menu-backdrop {
  position: fixed;
  inset:    0;
  z-index:  var(--z-dropdown);
}
.dt__menu {
  position:      absolute;
  right:         0;
  top:           calc(100% + 4px);
  z-index:       calc(var(--z-dropdown) + 1);
  background:    var(--surface-card);
  border:        1px solid var(--border-default);
  border-radius: var(--radius-lg);
  box-shadow:    var(--shadow-lg);
  min-width:     160px;
  padding:       var(--space-1);
  animation:     scaleIn 100ms ease forwards;
}
.dt__menu-item {
  display:       flex;
  align-items:   center;
  gap:           var(--space-2);
  width:         100%;
  padding:       var(--space-2) var(--space-3);
  font-size:     var(--text-sm);
  font-family:   var(--font-sans);
  font-weight:   var(--font-normal);
  color:         var(--text-primary);
  background:    none;
  border:        none;
  border-radius: var(--radius-md);
  cursor:        pointer;
  text-align:    left;
  transition:    background var(--transition-fast);
}
.dt__menu-item:hover { background: var(--color-gray-100); }
.dt__menu-item--danger { color: var(--color-danger-600); }
.dt__menu-item--danger:hover { background: var(--color-danger-50); }
.dt__menu-icon { display: flex; align-items: center; }
.dt__menu-icon svg, .dt__menu-icon > * { width: 14px; height: 14px; }

/* ---- Empty state ---- */
.dt__empty { padding: var(--space-16) var(--space-8); }
.dt__empty-inner {
  display:        flex;
  flex-direction: column;
  align-items:    center;
  gap:            var(--space-3);
  text-align:     center;
}
.dt__empty-icon svg { width: 48px; height: 48px; }
.dt__empty-title {
  font-size:   var(--text-base);
  font-weight: var(--font-semibold);
  color:       var(--text-primary);
}
.dt__empty-message {
  font-size: var(--text-sm);
  color:     var(--text-secondary);
}

/* ---- Pagination ---- */
.dt__pagination {
  display:         flex;
  align-items:     center;
  justify-content: space-between;
  padding:         var(--space-3) var(--space-4);
  border-top:      1px solid var(--border-default);
  background:      var(--surface-card);
  flex-wrap:       wrap;
  gap:             var(--space-3);
}
.dt__pagination-info {
  font-size: var(--text-sm);
  color:     var(--text-secondary);
}
.dt__pagination-nav {
  display:     flex;
  align-items: center;
  gap:         var(--space-1);
}
.dt__page-btn {
  display:       flex;
  align-items:   center;
  justify-content:center;
  min-width:     32px;
  height:        32px;
  padding:       0 var(--space-2);
  font-size:     var(--text-sm);
  font-family:   var(--font-sans);
  color:         var(--text-secondary);
  background:    none;
  border:        1px solid var(--border-default);
  border-radius: var(--radius-md);
  cursor:        pointer;
  transition:    background var(--transition-fast), color var(--transition-fast);
}
.dt__page-btn:hover:not(:disabled) {
  background:   var(--color-gray-100);
  color:        var(--text-primary);
}
.dt__page-btn--active {
  background:   var(--color-primary-600);
  border-color: var(--color-primary-600);
  color:        var(--color-gray-0);
  font-weight:  var(--font-medium);
}
.dt__page-btn--active:hover:not(:disabled) {
  background: var(--color-primary-700);
}
.dt__page-btn:disabled {
  opacity: 0.4;
  cursor:  not-allowed;
}
`