'use client';

import { LineChart } from "@mui/x-charts/LineChart";
import { useState, useMemo } from 'react';
import { Box, Slider, Typography, IconButton, Button, ButtonGroup } from '@mui/material';
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
    };
  }

  const mean = valid.reduce((sum, v) => sum + v, 0) / valid.length;
  const variance = valid.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / valid.length;
  const std = Math.sqrt(variance);

  return {
    mean,
    std,
    upper: mean + std,
    lower: mean - std,
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

    const speedingStats = useMemo(() => {
      return computeStats(filteredData.map(d => d.speeding));
    }, [filteredData]);

    const swervingStats = useMemo(() => {
      return computeStats(filteredData.map(d => d.swerving));
    }, [filteredData]);

    const abruptStats = useMemo(() => {
      return computeStats(filteredData.map(d => d.abruptStop));
    }, [filteredData]);

    const vehicleStats = useMemo(() => {
      return computeStats(filteredData.map(d => d.vehicles));
    }, [filteredData]);

    // SPEEDING STATS
    const speedingUpper = filteredData.map(d => d.speeding === null || speedingStats.std === null ? null : d.speeding + speedingStats.std);
    const speedingLower = filteredData.map(d => d.speeding === null || speedingStats.std === null ? null : d.speeding - speedingStats.std);
    const speedingBand = filteredData.map((_, i) => {
      if (speedingUpper[i] === null || speedingLower[i] === null) return null;
      return speedingUpper[i] - speedingLower[i];
    });

    const swervingUpper = filteredData.map(d => d.swerving === null || swervingStats.std === null ? null : d.swerving + swervingStats.std);
    const swervingLower = filteredData.map(d => d.swerving === null || swervingStats.std === null ? null : d.swerving - swervingStats.std);
    const swervingBand = filteredData.map((_, i) => {
      if (swervingUpper[i] === null || swervingLower[i] === null) return null;
      return swervingUpper[i] - swervingLower[i];
    });

    const abruptStopUpper = filteredData.map(d => d.abruptStop === null || abruptStats.std === null ? null : d.abruptStop + abruptStats.std);
    const abruptStopLower = filteredData.map(d => d.abruptStop === null || abruptStats.std === null ? null : d.abruptStop - abruptStats.std);
    const abruptStopBand = filteredData.map((_, i) => {
       if (abruptStopUpper[i] === null || abruptStopLower[i] === null) return null;
        return abruptStopUpper[i] - abruptStopLower[i];
    });

    const vehiclesUpper = filteredData.map(d => d.vehicles === null || vehicleStats.std === null ? null : d.vehicles + vehicleStats.std);
    const vehiclesLower = filteredData.map(d => d.vehicles === null || vehicleStats.std === null ? null : d.vehicles - vehicleStats.std);
    const vehiclesBand = filteredData.map((_, i) => {
       if (vehiclesUpper[i] === null || vehiclesLower[i] === null) return null;
        return vehiclesUpper[i] - vehiclesLower[i];
    });


  

  // Define series groupings - each metric has a main line and two band series
  const seriesGroups = {
    speeding: ['speeding-lower', 'speeding-band', 'speeding-line'],
    swerving: ['swerving-lower', 'swerving-band', 'swerving-line'],
    abruptStop: ['abruptStop-lower', 'abruptStop-band', 'abruptStop-line'],
    vehicles: ['vehicles-lower', 'vehicles-band', 'vehicles-line'],
  };

  // Handle series click
  const handleSeriesClick = (event, seriesId) => {
    // Find which group this series belongs to
    const group = Object.keys(seriesGroups).find(key => 
      seriesGroups[key].includes(seriesId)
    );
    
    // Toggle: if already highlighted, unhighlight; otherwise highlight this group
    if (highlightedSeries === group) {
      setHighlightedSeries(null);
    } else {
      setHighlightedSeries(group);
    }
  };

  const handleButtonClick = (metric) => {
    if (highlightedSeries === metric) {
      setHighlightedSeries(null); // Deselect if already selected
    } else {
      setHighlightedSeries(metric); // Select new metric
    }
  };

  // Helper function to determine opacity based on highlight state
  const showSeries = (group) => {
    if (!highlightedSeries) return true; // Nothing selected, show all normally
    return highlightedSeries === group; // Dim non-selected series
  };

  const getBandOpacity = (group) => {
    if (!highlightedSeries) return 0.25; // Default band opacity
    return highlightedSeries === group ? 0.3 : 0; // Increase selected, dim others
  };

  // Button configurations
  const metricButtons = [
    { key: 'speeding', label: 'Speeding', color: '#1976d2' },
    { key: 'swerving', label: 'Swerving', color: '#dc004e' },
    { key: 'abruptStop', label: 'Abrupt Stop', color: '#ff9800' },
    { key: 'vehicles', label: 'Vehicles', color: '#4caf50' },
  ];


  return (
    <Box sx={{ width: '100%', px: 2}}>
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

{/* Metric Selection Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3, gap: 1 }}>
        <ButtonGroup variant="outlined" size="small">
          {metricButtons.map(({ key, label, color }) => (
            <Button
              key={key}
              onClick={() => handleButtonClick(key)}
              variant={highlightedSeries === key ? 'contained' : 'outlined'}
              sx={{
                borderColor: color,
                color: highlightedSeries === key ? 'white' : color,
                backgroundColor: highlightedSeries === key ? color : 'transparent',
                '&:hover': {
                  borderColor: color,
                  backgroundColor: highlightedSeries === key ? color : `${color}15`,
                },
                textTransform: 'none',
                minWidth: '110px',
              }}
            >
              {label}
            </Button>
          ))}
          {highlightedSeries && (
            <Button
              onClick={() => setHighlightedSeries(null)}
              variant="outlined"
              sx={{
                borderColor: '#666',
                color: '#666',
                '&:hover': {
                  borderColor: '#666',
                  backgroundColor: '#66661a',
                },
                textTransform: 'none',
              }}
            >
              Show All
            </Button>
          )}
        </ButtonGroup>
      </Box>

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
          // {
          //   data: speedingUpper,
          //   showMark: false,
          //   color: 'rgba(25, 118, 210, 0.3)',
          //   area: true,
          // },
          ...(showSeries('speeding') ? [
          {
            id: 'speeding-lower',
            data: speedingLower,
            stack:'speeding-band',
            showMark: false,
            color: `rgba(25, 118, 210, ${getBandOpacity('speeding')})`,
            highlightScope,
            valueFormatter: () => null
          },
          {
            id: 'speeding-band',
            data: speedingBand,
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
          // {
          //   data: swervingUpper,
          //   showMark: false,
          //   color: 'rgba(220, 0, 78, 0.15)',
          //   area: true,
          //   stack: 'swerving'
          // },
          ...(showSeries('swerving') ? [
          {
            id: 'swerving-lower',
            data: swervingLower,
            stack:'swerving-band',
            showMark: false,
            color: `rgba(220, 0, 78, ${getBandOpacity('swerving')})`,
            valueFormatter: () => null
          },
          {
            id: 'swerving-band',
            data: swervingBand,
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
          // //ABRUPT STOP STATS
          // // {
          // //   data: abruptStopUpper,
          // //   showMark: false,
          // //   color: 'rgba(255, 152, 0, 0.3)',
          // //   area: true,
          // // },
          ...(showSeries('abruptStop') ? [{
            id: 'abruptStop-lower',
            data: abruptStopLower,
            stack:'abruptStop-band',
            showMark: false,
            color: `rgba(255, 152, 0, ${getBandOpacity('abruptStop')})`,
            valueFormatter: () => null
          },
          {
            id: 'abruptStop-band',
            data: abruptStopBand,
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
            color:'#ff9800',
            valueFormatter: (value: number | null) =>
              value === null ? "No video uploaded" : value.toString(),
          },
        ] : []),
          // // VEHICLE STATS
          // // {
          // //   data: vehiclesUpper,
          // //   showMark: false,
          // //   color: 'rgba(76, 175, 80, 0.3)',
            
          // // },
          
          ...(showSeries('vehicles') ? [
          {
            id: 'vehicles-lower',
            data: vehiclesLower,
            stack:'vehicles-band',
            showMark: false,
            color: `rgba(76, 175, 80, ${getBandOpacity('vehicles')})`,
            valueFormatter: () => null
          },
          {
            id: 'vehicles-band',
            data: vehiclesBand,
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
        // onMarkClick={(event, d) => {
        //   handleSeriesClick(event, d.seriesId);
        // }}
        // onLineClick={(event, d) => {
        //   handleSeriesClick(event, d.seriesId);
        // }}
        // onAxisClick={(event, d) => {
        //   // Click on axis area (not on a series) - clear highlight
        //   setHighlightedSeries(null);
        // }}
        // sx={{
        //   // Add cursor pointer to indicate clickable
        //   '& .MuiLineElement-root': {
        //     cursor: 'pointer',
        //     transition: 'opacity 0.3s ease',
        //     opacity: (theme) => {
        //       // This won't work directly, we use the color opacity instead
        //       return 1;
        //     }
        //   },
        //   '& .MuiMarkElement-root': {
        //     cursor: 'pointer',
        //     transition: 'opacity 0.3s ease',
        //   },
        //   '& .MuiAreaElement-root': {
        //     cursor: 'pointer',
        //     transition: 'opacity 0.3s ease',
        //   }
        // }}
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
