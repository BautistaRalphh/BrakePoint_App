'use client';

import { LineChart } from "@mui/x-charts/LineChart";
import { useState, useMemo } from 'react';
import { Box, Slider, Typography, IconButton, ToggleButton, ToggleButtonGroup, Chip } from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { HighlightScope } from '@mui/x-charts/context';

import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';


// -----------------------
// SAMPLE TIME DATA
// -----------------------
const SAMPLE_TIMELINE_DATA = [
  { date: new Date(2024, 0, 1), speeding: 45, swerving: 12, abruptStop: 8, vehicles: 156 },
  { date: new Date(2024, 0, 2), speeding: 67, swerving: 18, abruptStop: 15, vehicles: 203 },
  { date: new Date(2024, 0, 3), speeding: 52, swerving: 9, abruptStop: 11, vehicles: 178 },
  // Gap example: Jan 4 missing
  { date: new Date(2024, 0, 4), speeding: null, swerving: null, abruptStop: null, vehicles: null },
  { date: new Date(2024, 0, 5), speeding: 73, swerving: 21, abruptStop: 19, vehicles: 245 },
  { date: new Date(2024, 0, 6), speeding: 58, swerving: 14, abruptStop: 7, vehicles: 189 },
  { date: new Date(2024, 0, 7), speeding: 81, swerving: 25, abruptStop: 23, vehicles: 267 },
  { date: new Date(2024, 0, 8), speeding: 94, swerving: 31, abruptStop: 28, vehicles: 312 },
  { date: new Date(2024, 0, 9), speeding: null, swerving: null, abruptStop: null, vehicles: null },
  { date: new Date(2024, 0, 10), speeding: 69, swerving: 17, abruptStop: 14, vehicles: 234 },
  { date: new Date(2024, 0, 11), speeding: 41, swerving: 11, abruptStop: 9, vehicles: 167 },
  { date: new Date(2024, 0, 12), speeding: 55, swerving: 13, abruptStop: 6, vehicles: 198 },
  { date: new Date(2024, 0, 13), speeding: 88, swerving: 29, abruptStop: 21, vehicles: 289 },
];

function computeStats(values: (number | null)[]) {
  const valid = values.filter(v => v !== null) as number[];

  if (valid.length === 0) {
    return {
      mean: null,
      std: null,
      upper: null,
      lower: null,
      min: null,
      max: null,
      median: null,
    };
  }

  const mean = valid.reduce((sum, v) => sum + v, 0) / valid.length;
  const variance = valid.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / valid.length;
  const std = Math.sqrt(variance);

  const sorted = [...valid].sort((a, b) => a - b);
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];

  return {
    mean,
    std,
    upper: mean + std,
    lower: mean - std,
    min: Math.min(...valid),
    max: Math.max(...valid),
    median,
  };
}


export default function TimelineSlider() {
  const sortedData = useMemo(() => {
    return [...SAMPLE_TIMELINE_DATA].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );
  }, []);

  // Slider range uses index positions
  const WINDOW_SIZE = 4; // default window length

  // const [range, setRange] = useState([0, WINDOW_SIZE]);
  const [startDate, setStartDate] = useState(dayjs(sortedData[0].date));
  const [endDate, setEndDate] = useState(dayjs(sortedData[sortedData.length - 1].date));
  const [highlightedSeries, setHighlightedSeries] = useState(null);

  const maxIndex = sortedData.length - 1;

  // Filter by selected date index range
  // const filteredData = useMemo(() => {
  //   return sortedData.slice(range[0], range[1] + 1);
  // }, [range, sortedData]);

  // const formatFullDate = (date) =>
  //   date?.toLocaleDateString('en-US', {
  //     year: 'numeric',
  //     month: 'long',
  //     day: 'numeric',
  //   });

  // const shiftLeft = () => {
  //   if (range[0] === 0) return;
  //   setRange(([start, end]) => [start - 1, end - 1]);
  // };

  // const shiftRight = () => {
  //   if (range[1] >= maxIndex) return;
  //   setRange(([start, end]) => [start + 1, end + 1]);
  // };

  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    'speeding',
    'swerving',
    'abruptStop',
    'vehicles',
  ]);

  const filteredData = useMemo(() => {
    if (!startDate || !endDate) return sortedData;

    return sortedData.filter(d => {
      const current = dayjs(d.date);
      return (
        current.isAfter(startDate.subtract(1, 'day')) &&
        current.isBefore(endDate.add(1, 'day'))
      );
    });
  }, [startDate, endDate, sortedData]);

  const highlightScope: HighlightScope = {
    highlight: 'series',
    fade: 'global',
  };

  // // Calculate statistics for all metrics
  const statistics = useMemo(() => ({
    speeding: computeStats(filteredData.map(d => d.speeding)),
    swerving: computeStats(filteredData.map(d => d.swerving)),
    abruptStop: computeStats(filteredData.map(d => d.abruptStop)),
    vehicles: computeStats(filteredData.map(d => d.vehicles)),
  }), [filteredData]);

  // Calculate band data
  const bandData = useMemo(() => {
    const createBandData = (metric: 'speeding' | 'swerving' | 'abruptStop' | 'vehicles') => {
      const stats = statistics[metric];
      const lower = filteredData.map(d => {
        const val = d[metric];
        return val === null || stats.std === null ? null : Math.max(0, val - stats.std);
      });
      const upper = filteredData.map(d => {
        const val = d[metric];
        return val === null || stats.std === null ? null : val + stats.std;
      });
      const band = upper.map((u, i) => {
        if (u === null || lower[i] === null) return null;
        return u - lower[i];
      });
      return { lower, band };
    };

    return {
      speeding: createBandData('speeding'),
      swerving: createBandData('swerving'),
      abruptStop: createBandData('abruptStop'),
      vehicles: createBandData('vehicles'),
    };
  }, [filteredData, statistics]);

  // Define series groupings - each metric has a main line and two band series
  const handleMetricToggle = (
    event: React.MouseEvent<HTMLElement>,
    newMetrics: string[],
  ) => {
    // Ensure at least one metric is always selected
    if (newMetrics.length > 0) {
      setSelectedMetrics(newMetrics);
    }
  };

  const isMetricSelected = (metric: string) => {
    return selectedMetrics.includes(metric);
  };

  const getBandOpacity = (metric: string) => {
    return isMetricSelected(metric) ? 0.25 : 0;
  };

  const metricButtons = [
    { key: 'speeding', label: 'Speeding', color: '#1976d2' },
    { key: 'swerving', label: 'Swerving', color: '#dc004e' },
    { key: 'abruptStop', label: 'Abrupt Stop', color: '#ff9800' },
    { key: 'vehicles', label: 'Vehicles', color: '#4caf50' },
  ];

  return (
    <Box sx={{ width: '100%', px: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ mt: 1 }}>
        Aggressive Driving Behaviors Over Time
      </Typography>

      {/* <Box sx={{mt:4}}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            mb: 1,
          }}
        >
          <IconButton onClick={shiftLeft} disabled={range[0] === 0}>
            <ArrowBackIosNewIcon />
          </IconButton>

          <Typography fontWeight={600}>
            {formatFullDate(sortedData[range[0]].date)} —{" "}
            {formatFullDate(sortedData[range[1]].date)}
          </Typography>

          <IconButton onClick={shiftRight} disabled={range[1] >= maxIndex}>
            <ArrowForwardIosIcon />
          </IconButton>
        </Box>
      </Box> */}

      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            justifyContent: 'center',
            mb: 3,
            mt: 2,
          }}
        >
          <DatePicker
            label="Start Date"
            value={startDate}
            onChange={(newValue) => {
              if (!newValue) return;
              if (endDate && newValue.isAfter(endDate)) return;
              setStartDate(newValue);
            }}
            slotProps={{ textField: { size: 'small' } }}
          />

          <DatePicker
            label="End Date"
            value={endDate}
            onChange={(newValue) => {
              if (!newValue) return;
              if (startDate && newValue.isBefore(startDate)) return;
              setEndDate(newValue);
            }}
            slotProps={{ textField: { size: 'small' } }}
          />
        </Box>
      </LocalizationProvider>

      {/* Metric Toggle Buttons */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3, gap: 1.5 }}>
        <Typography variant="body2" color="text.secondary">
          Select metrics to compare:
        </Typography>
        <ToggleButtonGroup
          value={selectedMetrics}
          onChange={handleMetricToggle}
          aria-label="metric selection"
          size="small"
        >
          {metricButtons.map(({ key, label, color }) => (
            <ToggleButton
              key={key}
              value={key}
              aria-label={label}
              sx={{
                borderColor: color,
                color: isMetricSelected(key) ? 'white' : color,
                backgroundColor: isMetricSelected(key) ? color : 'transparent',
                '&.Mui-selected': {
                  backgroundColor: color,
                  color: 'white',
                  '&:hover': {
                    backgroundColor: color,
                    filter: 'brightness(0.9)',
                  },
                },
                '&:hover': {
                  backgroundColor: isMetricSelected(key) ? color : `${color}15`,
                  borderColor: color,
                },
                textTransform: 'none',
                minWidth: '110px',
                fontWeight: isMetricSelected(key) ? 600 : 400,
              }}
            >
              {label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {/* Show count of selected metrics */}
        <Chip
          label={`${selectedMetrics.length} metric${selectedMetrics.length !== 1 ? 's' : ''} selected`}
          size="small"
          color="primary"
          variant="outlined"
        />
      </Box>

      {/* Statistics Summary for Selected Metrics */}
      {selectedMetrics.length > 0 && (
        <Box sx={{ mb: 3, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 2 }}>
          {selectedMetrics.map((metric) => {
            const button = metricButtons.find(b => b.key === metric);
            const stats = statistics[metric as keyof typeof statistics];

            if (!button || stats.mean === null) return null;

            return (
              <Box
                key={metric}
                sx={{
                  p: 2,
                  borderRadius: 1,
                  border: `2px solid ${button.color}`,
                  backgroundColor: `${button.color}08`,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      bgcolor: button.color,
                    }}
                  />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {button.label}
                  </Typography>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Mean</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {stats.mean.toFixed(1)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Std Dev</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      ±{stats.std.toFixed(1)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Min</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {stats.min}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Max</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {stats.max}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      <LineChart
        xAxis={[
          {
            data: filteredData.map(d => d.date),
            scaleType: 'time',
            tickMinStep: 24 * 60 * 60 * 1000,
            valueFormatter: (value) =>
              value.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              }),
          },
        ]}
        series={[
          // SPEEDING STATS
          ...(isMetricSelected('speeding') ? [
            {
              id: 'speeding-lower',
              data: bandData.speeding.lower,
              stack: 'speeding-band',
              showMark: false,
              color: `rgba(25, 118, 210, ${getBandOpacity('speeding')})`,
              highlightScope,
              valueFormatter: () => null
            },
            {
              id: 'speeding-band',
              data: bandData.speeding.band,
              stack: 'speeding-band',
              showMark: false,
              area: true,
              color: `rgba(25, 118, 210, ${getBandOpacity('speeding')})`,
              valueFormatter: () => null
            },
            {
              id: 'speeding-line',
              data: filteredData.map(d => d.speeding),
              label: 'Speeding',
              connectNulls: false,
              showMark: true,
              highlightScope,
              color: '#1976d2',
              valueFormatter: (value: number | null) =>
                value === null ? "No video uploaded" : value.toString(),
            },
          ] : []),

          // SWERVING STATS
          ...(isMetricSelected('swerving') ? [
            {
              id: 'swerving-lower',
              data: bandData.swerving.lower,
              stack: 'swerving-band',
              showMark: false,
              color: `rgba(220, 0, 78, ${getBandOpacity('swerving')})`,
              valueFormatter: () => null
            },
            {
              id: 'swerving-band',
              data: bandData.swerving.band,
              stack: 'swerving-band',
              showMark: false,
              area: true,
              color: `rgba(220, 0, 78, ${getBandOpacity('swerving')})`,
              valueFormatter: () => null
            },
            {
              id: 'swerving-line',
              data: filteredData.map(d => d.swerving),
              label: 'Swerving',
              connectNulls: false,
              showMark: true,
              color: '#dc004e',
              highlightScope,
              valueFormatter: (value: number | null) =>
                value === null ? "No video uploaded" : value.toString(),
            },
          ] : []),

          // ABRUPT STOP STATS
          ...(isMetricSelected('abruptStop') ? [{
            id: 'abruptStop-lower',
            data: bandData.abruptStop.lower,
            stack: 'abruptStop-band',
            showMark: false,
            color: `rgba(255, 152, 0, ${getBandOpacity('abruptStop')})`,
            valueFormatter: () => null
          },
          {
            id: 'abruptStop-band',
            data: bandData.abruptStop.band,
            stack: 'abruptStop-band',
            showMark: false,
            area: true,
            color: `rgba(255, 152, 0, ${getBandOpacity('abruptStop')})`,
            valueFormatter: () => null
          },
          {
            id: 'abruptStop-line',
            data: filteredData.map(d => d.abruptStop),
            label: 'Abrupt Stopping',
            connectNulls: false,
            showMark: true,
            highlightScope,
            color: '#ff9800',
            valueFormatter: (value: number | null) =>
              value === null ? "No video uploaded" : value.toString(),
          },
          ] : []),

          //  VEHICLE STATS
          ...(isMetricSelected('vehicles') ? [
            {
              id: 'vehicles-lower',
              data: bandData.vehicles.lower,
              stack: 'vehicles-band',
              showMark: false,
              color: `rgba(76, 175, 80, ${getBandOpacity('vehicles')})`,
              valueFormatter: () => null
            },
            {
              id: 'vehicles-band',
              data: bandData.vehicles.band,
              stack: 'vehicles-band',
              showMark: false,
              area: true,
              color: `rgba(76, 175, 80, ${getBandOpacity('vehicles')})`,
              valueFormatter: () => null
            },
            {
              id: 'vehicles-line',
              data: filteredData.map(d => d.vehicles),
              label: 'Vehicle Count',
              connectNulls: false,
              showMark: true,
              color: 'rgba(76, 175, 80)',
              highlightScope,
              valueFormatter: (value: number | null) =>
                value === null ? "No video uploaded" : value.toString(),
            },
          ] : []),
        ]}

        height={300}
        sx={{
          '& .MuiChartsLegend-root': {
            display: 'none',
          }
        }}
      />



      {/* <Box sx={{ mb: 5, flex: 1, px: 7 }}>
        <Typography variant="body2" gutterBottom>
          Date Range
        </Typography>
        <Slider
          value={range}
          onChange={(_, newValue) => setRange(newValue)}
          marks
          min={0}
          max={sortedData.length - 1}
          step={1}
          valueLabelDisplay="auto"
          valueLabelFormat={(value) =>
            sortedData[value].date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })
          }
        />
        
      </Box> */}

    </Box>
  );
}


//--------------------------------------------------------------------------------------------------


// 'use client';

// import { LineChart } from "@mui/x-charts/LineChart";
// import { useState, useMemo } from "react";
// import { Box, Typography } from "@mui/material";

// import { DatePicker } from "@mui/x-date-pickers/DatePicker";
// import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
// import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

// import dayjs from "dayjs";



// // -----------------------
// // SAMPLE DATA
// // -----------------------
// const SAMPLE_TIMELINE_DATA = [
//   { date: new Date(2024, 0, 1), speeding: 5, swerving: 1, abruptStop: 0, vehicles: 10 },
//   { date: new Date(2024, 0, 2), speeding: 10, swerving: 0, abruptStop: 2, vehicles: 20 },
//   { date: new Date(2024, 0, 3), speeding: 9, swerving: 1, abruptStop: 0, vehicles: 15 },

//   { date: new Date(2024, 0, 4), speeding: null, swerving: null, abruptStop: null, vehicles: null },

//   { date: new Date(2024, 0, 5), speeding: 8, swerving: 2, abruptStop: 0, vehicles: 22 },
//   { date: new Date(2024, 0, 6), speeding: 6, swerving: 3, abruptStop: 0, vehicles: 26 },
//   { date: new Date(2024, 0, 7), speeding: 10, swerving: 2, abruptStop: 8, vehicles: 30 },

//   { date: new Date(2024, 0, 8), speeding: 6, swerving: 8, abruptStop: 14, vehicles: 32 },

//   { date: new Date(2024, 0, 9), speeding: null, swerving: null, abruptStop: null, vehicles: null },

//   { date: new Date(2024, 0, 10), speeding: 9, swerving: 2, abruptStop: 7, vehicles: 24 },
//   { date: new Date(2024, 0, 11), speeding: 1, swerving: 5, abruptStop: 4, vehicles: 21 },
//   { date: new Date(2024, 0, 12), speeding: 5, swerving: 1, abruptStop: 0, vehicles: 18 },
//   { date: new Date(2024, 0, 13), speeding: 10, swerving: 19, abruptStop: 7, vehicles: 44 },
// ];


// export default function TimelineSlider() {

//   //--------------------------------------------------
//   // Sort data once
//   //--------------------------------------------------
//   const sortedData = useMemo(() => {
//     return [...SAMPLE_TIMELINE_DATA].sort(
//       (a, b) => a.date.getTime() - b.date.getTime()
//     );
//   }, []);


//   //--------------------------------------------------
//   // Date picker state
//   //--------------------------------------------------
//   const [startDate, setStartDate] = useState(dayjs(sortedData[0].date));
//   const [endDate, setEndDate] = useState(dayjs(sortedData.at(-1).date));


//   //--------------------------------------------------
//   // Filter data safely
//   //--------------------------------------------------
//   const filteredData = useMemo(() => {

//     if (!startDate || !endDate) return sortedData;

//     return sortedData.filter(d => {

//       const current = dayjs(d.date);

//       return (
//         current.isSame(startDate, "day") ||
//         current.isSame(endDate, "day") ||
//         (current.isAfter(startDate, "day") &&
//          current.isBefore(endDate, "day"))
//       );

//     });

//   }, [sortedData, startDate, endDate]);


//   //--------------------------------------------------
//   // Detect missing ranges
//   //--------------------------------------------------
//   const missingRanges = useMemo(() => {

//     const ranges = [];
//     let start = null;

//     filteredData.forEach((d, i) => {

//       const missing =
//         d.speeding === null &&
//         d.swerving === null &&
//         d.abruptStop === null &&
//         d.vehicles === null;

//       if (missing && start === null)
//         start = d.date;

//       if (!missing && start !== null) {

//         ranges.push({
//           start,
//           end: filteredData[i - 1].date
//         });

//         start = null;
//       }

//     });

//     if (start !== null)
//       ranges.push({
//         start,
//         end: filteredData.at(-1).date
//       });

//     return ranges;

//   }, [filteredData]);


//   //--------------------------------------------------
//   // Chart bounds
//   //--------------------------------------------------
//   const chartStart = filteredData[0]?.date?.getTime();
//   const chartEnd = filteredData.at(-1)?.date?.getTime();
//   const chartDuration = chartEnd - chartStart;


//   //--------------------------------------------------
//   // Render
//   //--------------------------------------------------
//   return (
//     <Box sx={{ width: "100%", px: 2 }}>

//       <Typography variant="h6" sx={{ mb: 2 }}>
//         Aggressive Driving Behaviors Over Time
//       </Typography>


//       {/* DATE PICKERS */}
//       <LocalizationProvider dateAdapter={AdapterDayjs}>

//         <Box sx={{
//           display: "flex",
//           gap: 2,
//           justifyContent: "center",
//           mb: 3
//         }}>

//           <DatePicker
//             label="Start Date"
//             value={startDate}
//             onChange={(v) => {
//               if (!v || v.isAfter(endDate)) return;
//               setStartDate(v);
//             }}
//             slotProps={{ textField: { size: "small" } }}
//           />

//           <DatePicker
//             label="End Date"
//             value={endDate}
//             onChange={(v) => {
//               if (!v || v.isBefore(startDate)) return;
//               setEndDate(v);
//             }}
//             slotProps={{ textField: { size: "small" } }}
//           />

//         </Box>

//       </LocalizationProvider>



//       {/* CHART CONTAINER */}
//       <Box sx={{
//         position: "relative",
//         width: "100%",
//         height: 300
//       }}>


//         {/* SHADED MISSING REGIONS */}
//         {missingRanges.map((range, i) => {

//           const left =
//             ((range.start.getTime() - chartStart)
//             / chartDuration) * 100;

//           const width =
//             ((range.end.getTime() - range.start.getTime())
//             / chartDuration) * 100;

//           return (
//             <Box
//               key={i}
//               sx={{
//                 position: "absolute",
//                 left: `${left}%`,
//                 width: `${width}%`,
//                 top: 0,
//                 bottom: 0,

//                 backgroundColor: "rgba(0,0,0,0.08)",

//                 borderLeft: "2px dashed grey",
//                 borderRight: "2px dashed grey",

//                 display: "flex",
//                 alignItems: "center",
//                 justifyContent: "center",

//                 pointerEvents: "none",
//                 zIndex: 1
//               }}
//             >
//               <Typography
//                 variant="caption"
//                 color="text.secondary"
//               >
//                 No video uploaded
//               </Typography>
//             </Box>
//           );

//         })}



//         {/* CHART */}
//         <LineChart

//           xAxis={[{
//             data: filteredData.map(d => d.date),
//             scaleType: "time",
//             tickMinStep: 24 * 60 * 60 * 1000,
//             valueFormatter: (date) =>
//               date.toLocaleDateString("en-US", {
//                 month: "short",
//                 day: "numeric"
//               })
//           }]}


//           series={[
//             {
//               data: filteredData.map(d => d.speeding),
//               label: "Speeding",
//               connectNulls: false,
//               showMark: true,
//               valueFormatter: (v: number | null) =>
//                 v !== null ? v.toString() : "No video uploaded"
//             },

//             {
//               data: filteredData.map(d => d.swerving),
//               label: "Swerving",
//               connectNulls: false,
//               showMark: true,
//               valueFormatter: (v: number | null) =>
//                 v !== null ? v.toString() : "No video uploaded"
//             },

//             {
//               data: filteredData.map(d => d.abruptStop),
//               label: "Abrupt Stop",
//               connectNulls: false,
//               showMark: true,
//               valueFormatter: (v: number | null) =>
//                 v !== null ? v.toString() : "No video uploaded"
//             },

//             {
//               data: filteredData.map(d => d.vehicles),
//               label: "Vehicle Count",
//               connectNulls: false,
//               showMark: true,
//               valueFormatter: (v: number | null) =>
//                 v !== null ? v.toString() : "No video uploaded"
//             }

//           ]}

//           height={300}

//         />

//       </Box>


//     </Box>
//   );
// }
