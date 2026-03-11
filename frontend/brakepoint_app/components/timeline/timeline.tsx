'use client';

import { LineChart } from "@mui/x-charts/LineChart";
import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Box, Typography, ToggleButton, ToggleButtonGroup, Chip,
  CircularProgress,
} from '@mui/material';
import { HighlightScope } from '@mui/x-charts/context';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import { authFetch } from '@/lib/authFetch';

// ===========================================
// Types
// ===========================================
type TimelineRow = {
  date: Date;
  speeding: number | null;
  swerving: number | null;
  abruptStop: number | null;
  vehicles: number | null;
};

type TimelineProps = {
  /** Camera IDs whose data should be aggregated. When empty the chart shows a prompt. */
  cameraIds?: (number | string)[];
};

// ===========================================
// Constants
// ===========================================
const METRIC_CFG = [
  { key: 'speeding',   label: 'Speeding',       color: '#5c6bc0' },
  { key: 'swerving',   label: 'Swerving',       color: '#ef5350' },
  { key: 'abruptStop', label: 'Abrupt Stop',    color: '#ffa726' },
  { key: 'vehicles',   label: 'Vehicles',       color: '#66bb6a' },
] as const;

type MetricKey = typeof METRIC_CFG[number]['key'];

// ===========================================
// Stats helper
// ===========================================
function computeStats(values: (number | null)[]) {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0)
    return { mean: null, std: null, min: null, max: null, median: null };

  const mean = valid.reduce((s, v) => s + v, 0) / valid.length;
  const std = Math.sqrt(valid.reduce((s, v) => s + (v - mean) ** 2, 0) / valid.length);
  const sorted = [...valid].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];

  return { mean, std, min: Math.min(...valid), max: Math.max(...valid), median };
}

// ===========================================
// Component
// ===========================================
export default function Timeline({ cameraIds = [] }: TimelineProps) {

  // --- data state ---
  const [rows, setRows] = useState<TimelineRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- filter / UI state ---
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    'speeding', 'swerving', 'abruptStop', 'vehicles',
  ]);

  // Stabilise the array prop so useCallback/useEffect don't loop
  const cameraIdsKey = JSON.stringify([...cameraIds].sort());

  // --- fetch from backend ---
  const fetchTimeline = useCallback(async () => {
    const ids: (number | string)[] = JSON.parse(cameraIdsKey);
    if (ids.length === 0) { setRows([]); return; }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('camera_ids', ids.join(','));
      if (startDate) params.set('start', startDate.format('YYYY-MM-DD'));
      if (endDate) params.set('end', endDate.format('YYYY-MM-DD'));

      const res = await authFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/behavior-timeline/?${params}`,
      );

      if (!res.ok) throw new Error('Failed to load timeline');
      const json = await res.json();

      if (json.success && Array.isArray(json.timeline)) {
        setRows(
          json.timeline.map((r: any) => ({
            date: new Date(r.date),
            speeding: r.speeding ?? null,
            swerving: r.swerving ?? null,
            abruptStop: r.abrupt_stopping ?? null,
            vehicles: r.vehicles ?? null,
          })),
        );
      } else {
        setRows([]);
      }
    } catch (err: any) {
      setError(err.message ?? 'Unknown error');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [cameraIdsKey, startDate, endDate]);

  //useEffect(() => { fetchTimeline(); }, [fetchTimeline]);

  // FOR TESTING
  const USE_MOCK = true;
  useEffect(() => {
    if (USE_MOCK) return;
    fetchTimeline();
  }, [fetchTimeline]);

  useEffect(() => {
    if (!USE_MOCK) return;

    const today = new Date();

    const mock: TimelineRow[] = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (13 - i));

      return {
        date: d,
        speeding: Math.floor(Math.random() * 20),
        swerving: Math.floor(Math.random() * 15),
        abruptStop: Math.floor(Math.random() * 10),
        vehicles: Math.floor(Math.random() * 200) + 50,
      };
    });

    setRows(mock);
  }, []);

  // --- derived data ---
  const sortedData = useMemo(
    () => [...rows].sort((a, b) => a.date.getTime() - b.date.getTime()),
    [rows],
  );

  const statistics = useMemo(() => ({
    speeding:   computeStats(sortedData.map(d => d.speeding)),
    swerving:   computeStats(sortedData.map(d => d.swerving)),
    abruptStop: computeStats(sortedData.map(d => d.abruptStop)),
    vehicles:   computeStats(sortedData.map(d => d.vehicles)),
  }), [sortedData]);

  const bandData = useMemo(() => {
    const build = (key: MetricKey) => {
      const stats = statistics[key];
      const lower = sortedData.map(d => {
        const v = d[key]; return v == null || stats.std == null ? null : Math.max(0, v - stats.std);
      });
      const upper = sortedData.map(d => {
        const v = d[key]; return v == null || stats.std == null ? null : v + stats.std;
      });
      const band = upper.map((u, i) => u == null || lower[i] == null ? null : u - lower[i]!);
      return { lower, band };
    };
    return { speeding: build('speeding'), swerving: build('swerving'), abruptStop: build('abruptStop'), vehicles: build('vehicles') };
  }, [sortedData, statistics]);

  // --- helpers ---
  const isOn = (k: string) => selectedMetrics.includes(k);
  const bandOp = (k: string) => isOn(k) ? 0.18 : 0;

  const highlightScope: HighlightScope = { highlight: 'series', fade: 'global' };

  const handleToggle = (_: React.MouseEvent<HTMLElement>, next: string[]) => {
    if (next.length > 0) setSelectedMetrics(next);
  };

  // --- empty / loading states ---
  const noData = !loading && sortedData.length === 0;
  const noCameras = cameraIds.length === 0;

  // ===========================================
  // JSX
  // ===========================================
  return (
    <Box
      sx={{
        width: '100%',
        bgcolor: '#fff',
        borderRadius: '16px',
        p: { xs: 2, sm: 3 },
        boxSizing: 'border-box',
      }}
    >

      {/* Header row  */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#1d1f3f' }}>
          Driving Behaviors Over Time
        </Typography>

        <Chip
          label={`${selectedMetrics.length} metric${selectedMetrics.length !== 1 ? 's' : ''}`}
          size="small"
          sx={{ bgcolor: '#1d1f3f', color: '#fff', fontWeight: 600, fontSize: '0.75rem' }}
        />
      </Box>

      {/* Date pickers */}
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2.5 }}>
          <DatePicker
            label="From"
            value={startDate}
            onChange={(v) => { if (!v) return; if (endDate && v.isAfter(endDate)) return; setStartDate(v); }}
            slotProps={{ textField: { size: 'small', sx: { bgcolor: '#fff', minWidth: 140, '& .MuiOutlinedInput-root': { borderRadius: '12px' } } } }}
          />
          <DatePicker
            label="To"
            value={endDate}
            onChange={(v) => { if (!v) return; if (startDate && v.isBefore(startDate)) return; setEndDate(v); }}
            slotProps={{ textField: { size: 'small', sx: { bgcolor: '#fff', minWidth: 140, '& .MuiOutlinedInput-root': { borderRadius: '12px' } } } }}
          />
        </Box>
      </LocalizationProvider>

      {/* Metric toggles */}
      <Box sx={{ mb: 2.5 }}>
        <ToggleButtonGroup
          value={selectedMetrics}
          onChange={handleToggle}
          aria-label="metric selection"
          size="small"
          sx={{ flexWrap: 'wrap', gap: 0.5 }}
        >
          {METRIC_CFG.filter(c => c.key !== 'vehicles').map(({ key, label, color }) => (
            <ToggleButton
              key={key}
              value={key}
              sx={{
                borderRadius: '10px !important',
                border: `1.5px solid ${color} !important`,
                color: isOn(key) ? '#fff' : color,
                bgcolor: isOn(key) ? color : 'transparent',
                textTransform: 'none',
                fontWeight: isOn(key) ? 700 : 500,
                px: 2,
                '&.Mui-selected': {
                  bgcolor: color, color: '#fff',
                  '&:hover': { bgcolor: color, filter: 'brightness(0.92)' },
                },
                '&:hover': { bgcolor: isOn(key) ? color : `${color}12` },
              }}
            >
              {label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* Stat cards */}
      {sortedData.length > 0 && selectedMetrics.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 1.5,
            mb: 2.5,
          }}
        >
          {METRIC_CFG.map(({ key, label, color }) => {
            const s = statistics[key as MetricKey];
            if (!s || s.mean == null) return null;
            const isVisible = key === 'vehicles' || isOn(key);
            if (!isVisible) return null;

            return (
              <Box
                key={key}
                sx={{
                  p: 1.5,
                  borderRadius: '12px',
                  border: `1.5px solid ${color}40`,
                  bgcolor: `${color}08`,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color }} />
                  <Typography variant="caption" sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#1d1f3f' }}>
                    {label}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between', alignItems: 'center' }}>
                  {([
                    ['Mean', (Math.floor(s.mean)).toFixed(0)],
                    ['Std', `\u00B1${(Math.ceil(s.std!)).toFixed(0)}`],
                    ['Range', `${s.min} - ${s.max}`],
                  ] as [string, string | number][]).map(([lbl, val]) => (
                    <Box key={lbl}>
                      <Typography variant="caption" sx={{ fontSize: '0.8rem' }}>{lbl}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{val}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Chart area */}
      {loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, gap: 1.5 }}>
          <CircularProgress size={32} sx={{ color: '#1d1f3f' }} />
          <Typography variant="body2" color="text.secondary">Loading timeline data…</Typography>
        </Box>
      )}

      {noCameras && !loading && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="body2" color="text.secondary">
            Select cameras on the map to view behavior data.
          </Typography>
        </Box>
      )}

      {noData && !noCameras && !error && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="body2" color="text.secondary">
            No video data found for the selected cameras and date range.
          </Typography>
        </Box>
      )}

      {error && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="body2" color="error">{error}</Typography>
        </Box>
      )}

      {!loading && sortedData.length > 0 && (
        <LineChart
          xAxis={[{
            data: sortedData.map(d => d.date),
            scaleType: 'time',
            tickMinStep: 24 * 60 * 60 * 1000,
            valueFormatter: (v: Date) => v.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          }]}
          series={[
            // ---------- speeding ----------
            ...(isOn('speeding') ? [
              { id: 'sp-lo', data: bandData.speeding.lower, stack: 'sp-b', showMark: false, color: `rgba(92,107,192,${bandOp('speeding')})`, valueFormatter: () => null },
              { id: 'sp-hi', data: bandData.speeding.band,  stack: 'sp-b', showMark: false, area: true, color: `rgba(92,107,192,${bandOp('speeding')})`, valueFormatter: () => null },
              { id: 'sp', data: sortedData.map(d => d.speeding), label: 'Speeding', connectNulls: false, showMark: true, highlightScope, color: '#5c6bc0',
                valueFormatter: (v: number | null) => v == null ? 'No data' : v.toString() },
            ] : []),
            // ---------- swerving ----------
            ...(isOn('swerving') ? [
              { id: 'sw-lo', data: bandData.swerving.lower, stack: 'sw-b', showMark: false, color: `rgba(239,83,80,${bandOp('swerving')})`, valueFormatter: () => null },
              { id: 'sw-hi', data: bandData.swerving.band,  stack: 'sw-b', showMark: false, area: true, color: `rgba(239,83,80,${bandOp('swerving')})`, valueFormatter: () => null },
              { id: 'sw', data: sortedData.map(d => d.swerving), label: 'Swerving', connectNulls: false, showMark: true, highlightScope, color: '#ef5350',
                valueFormatter: (v: number | null) => v == null ? 'No data' : v.toString() },
            ] : []),
            // ---------- abruptStop ----------
            ...(isOn('abruptStop') ? [
              { id: 'as-lo', data: bandData.abruptStop.lower, stack: 'as-b', showMark: false, color: `rgba(255,167,38,${bandOp('abruptStop')})`, valueFormatter: () => null },
              { id: 'as-hi', data: bandData.abruptStop.band,  stack: 'as-b', showMark: false, area: true, color: `rgba(255,167,38,${bandOp('abruptStop')})`, valueFormatter: () => null },
              { id: 'as', data: sortedData.map(d => d.abruptStop), label: 'Abrupt Stop', connectNulls: false, showMark: true, highlightScope, color: '#ffa726',
                valueFormatter: (v: number | null) => v == null ? 'No data' : v.toString() },
            ] : []),
            // ---------- vehicles ----------
              { id: 'vh-lo', data: bandData.vehicles.lower, stack: 'vh-b', showMark: false, color: `rgba(102,187,106,${bandOp('vehicles')})`, valueFormatter: () => null },
              { id: 'vh-hi', data: bandData.vehicles.band,  stack: 'vh-b', showMark: false, area: true, color: `rgba(102,187,106,${bandOp('vehicles')})`, valueFormatter: () => null },
              { id: 'vh', data: sortedData.map(d => d.vehicles), label: 'Vehicles', connectNulls: false, showMark: true, highlightScope, color: '#66bb6a',
                valueFormatter: (v: number | null) => v == null ? 'No data' : v.toString() },
          ]}
          height={280}
          margin={{ left: 48, right: 16, top: 16, bottom: 30 }}
          sx={{
            '& .MuiChartsLegend-root': { display: 'none' },
            '& .MuiChartsAxis-tickLabel': { fontFamily: 'Montserrat', fontSize: '0.7rem' },
          }}
        />
      )}
    </Box>
  );
}
