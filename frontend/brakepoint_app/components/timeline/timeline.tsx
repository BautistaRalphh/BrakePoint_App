'use client';

import { LineChart } from "@mui/x-charts/LineChart";
import { useState, useMemo } from 'react';
import { Box, Slider, Typography, IconButton } from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';


// -----------------------
// SAMPLE TIME DATA
// -----------------------
const SAMPLE_TIMELINE_DATA = [
  { date: new Date(2024, 0, 1), speeding: 5, swerving: 1, abruptStop: 0, vehicles: 10 },
  { date: new Date(2024, 0, 2), speeding: 10, swerving: 0, abruptStop: 2, vehicles: 20 },
  { date: new Date(2024, 0, 3), speeding: 9, swerving: 1, abruptStop: 0, vehicles: 15 },
  // Gap example: Jan 4 missing
  {date: new Date(2024, 0, 4), speeding: null, swerving: null, abruptStop: null, vehicles: null },
  
  { date: new Date(2024, 0, 5), speeding: 8, swerving: 2, abruptStop: 0, vehicles: 22 },
  { date: new Date(2024, 0, 6), speeding: 6, swerving: 3, abruptStop: 0, vehicles: 26 },
  { date: new Date(2024, 0, 7), speeding: 10, swerving: 2, abruptStop: 8, vehicles: 30 },
  { date: new Date(2024, 0, 8), speeding: 6, swerving: 8, abruptStop: 14, vehicles: 32 },
  { date: new Date(2024, 0, 9), speeding: null, swerving: null, abruptStop: null, vehicles: null },
  { date: new Date(2024, 0, 10), speeding: 9, swerving: 2, abruptStop: 7, vehicles: 24 },
  { date: new Date(2024, 0, 11), speeding: 1, swerving: 5, abruptStop: 4, vehicles: 21 },
  { date: new Date(2024, 0, 12), speeding: 5, swerving: 1, abruptStop: 0, vehicles: 18 },
  { date: new Date(2024, 0, 13), speeding: 10, swerving: 19, abruptStop: 7, vehicles: 44 },
];


// - not just for a day, over a span of time dapat ?
// - show min and max on time range
// - if the whole slider timeline represents the whole day -> add values on both ends + date
// - instead of time range hour, do it with date instead
// - make it so that the date can be chosen
// - default: click intersection -> show data captured today or last date with data
// - but there also has to be a way which dates u wanna view
// - arrow date -> like picking flights nd all

export default function TimelineSlider() {
  const sortedData = useMemo(() => {
      return [...SAMPLE_TIMELINE_DATA].sort(
        (a, b) => a.date.getTime() - b.date.getTime()
      );
    }, []);

    // Slider range uses index positions
    const WINDOW_SIZE = 4; // default window length

  // const [range, setRange] = useState([0, WINDOW_SIZE]);
  const [startDate, setStartDate] = useState(
    dayjs(sortedData[0].date)
  );

  const [endDate, setEndDate] = useState(
    dayjs(sortedData[sortedData.length - 1].date)
  );


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
          {
            data: filteredData.map(d => d.speeding),
            label: 'Speeding',
            connectNulls: false,
            showMark: true,
            // stack: 'adb',
          },
          {
            data: filteredData.map(d => d.swerving),
            label: 'Swerving',
            connectNulls: false,
            showMark: true,
            // stack: 'adb',
          },
          {
            data: filteredData.map(d => d.abruptStop),
            label: 'Abrupt Stopping',
            connectNulls: false,
            showMark: true,
            // stack: 'adb',
          },
          {
            data: filteredData.map(d => d.vehicles),
            label: 'Vehicle Count',
            connectNulls: false,
            showMark: true,
            color: '#4caf50',
          },
        ]}
        height={300}
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


// 'use client';

// import { LineChart } from "@mui/x-charts/LineChart";
// import { useState, useMemo } from 'react';
// import { Box, Slider, Typography, IconButton } from '@mui/material';
// import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
// import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

// import { DatePicker } from '@mui/x-date-pickers/DatePicker';
// import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
// import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
// import dayjs from 'dayjs';


// // -----------------------
// // SAMPLE TIME DATA WITH STD DEV
// // -----------------------
// const SAMPLE_TIMELINE_DATA = [
//   { date: new Date(2024, 0, 1), speeding: 5, swerving: 1, abruptStop: 0, vehicles: 10, speedingStd: 1.2, swervingStd: 0.5, abruptStopStd: 0.3, vehiclesStd: 2 },
//   { date: new Date(2024, 0, 2), speeding: 10, swerving: 0, abruptStop: 2, vehicles: 20, speedingStd: 1.5, swervingStd: 0.4, abruptStopStd: 0.6, vehiclesStd: 3 },
//   { date: new Date(2024, 0, 3), speeding: 9, swerving: 1, abruptStop: 0, vehicles: 15, speedingStd: 1.3, swervingStd: 0.5, abruptStopStd: 0.2, vehiclesStd: 2.5 },
//   { date: new Date(2024, 0, 4), speeding: null, swerving: null, abruptStop: null, vehicles: null, speedingStd: null, swervingStd: null, abruptStopStd: null, vehiclesStd: null },
//   { date: new Date(2024, 0, 5), speeding: 8, swerving: 2, abruptStop: 0, vehicles: 22, speedingStd: 1.1, swervingStd: 0.7, abruptStopStd: 0.3, vehiclesStd: 3.2 },
//   { date: new Date(2024, 0, 6), speeding: 6, swerving: 3, abruptStop: 0, vehicles: 26, speedingStd: 1.0, swervingStd: 0.8, abruptStopStd: 0.2, vehiclesStd: 3.5 },
//   { date: new Date(2024, 0, 7), speeding: 10, swerving: 2, abruptStop: 8, vehicles: 30, speedingStd: 1.6, swervingStd: 0.6, abruptStopStd: 1.2, vehiclesStd: 4 },
//   { date: new Date(2024, 0, 8), speeding: 6, swerving: 8, abruptStop: 14, vehicles: 32, speedingStd: 1.2, swervingStd: 1.5, abruptStopStd: 2.1, vehiclesStd: 4.2 },
//   { date: new Date(2024, 0, 9), speeding: null, swerving: null, abruptStop: null, vehicles: null, speedingStd: null, swervingStd: null, abruptStopStd: null, vehiclesStd: null },
//   { date: new Date(2024, 0, 10), speeding: 9, swerving: 2, abruptStop: 7, vehicles: 24, speedingStd: 1.4, swervingStd: 0.7, abruptStopStd: 1.0, vehiclesStd: 3.3 },
//   { date: new Date(2024, 0, 11), speeding: 1, swerving: 5, abruptStop: 4, vehicles: 21, speedingStd: 0.8, swervingStd: 1.0, abruptStopStd: 0.8, vehiclesStd: 2.8 },
//   { date: new Date(2024, 0, 12), speeding: 5, swerving: 1, abruptStop: 0, vehicles: 18, speedingStd: 1.0, swervingStd: 0.5, abruptStopStd: 0.2, vehiclesStd: 2.5 },
//   { date: new Date(2024, 0, 13), speeding: 10, swerving: 19, abruptStop: 7, vehicles: 44, speedingStd: 1.5, swervingStd: 3.2, abruptStopStd: 1.1, vehiclesStd: 5.5 },
// ];

// export default function TimelineSlider() {
//   const sortedData = useMemo(() => {
//     return [...SAMPLE_TIMELINE_DATA].sort(
//       (a, b) => a.date.getTime() - b.date.getTime()
//     );
//   }, []);

//   const [startDate, setStartDate] = useState(
//     dayjs(sortedData[0].date)
//   );

//   const [endDate, setEndDate] = useState(
//     dayjs(sortedData[sortedData.length - 1].date)
//   );

//   const filteredData = useMemo(() => {
//     if (!startDate || !endDate) return sortedData;

//     return sortedData.filter(d => {
//       const current = dayjs(d.date);
//       return (
//         current.isAfter(startDate.subtract(1, 'day')) &&
//         current.isBefore(endDate.add(1, 'day'))
//       );
//     });
//   }, [startDate, endDate, sortedData]);

//   // Calculate bounds for error bands
//   const errorBands = useMemo(() => {
//     return {
//       speeding: {
//         upper: filteredData.map(d => d.speeding !== null ? d.speeding + d.speedingStd : null),
//         lower: filteredData.map(d => d.speeding !== null ? Math.max(0, d.speeding - d.speedingStd) : null),
//       },
//       swerving: {
//         upper: filteredData.map(d => d.swerving !== null ? d.swerving + d.swervingStd : null),
//         lower: filteredData.map(d => d.swerving !== null ? Math.max(0, d.swerving - d.swervingStd) : null),
//       },
//       abruptStop: {
//         upper: filteredData.map(d => d.abruptStop !== null ? d.abruptStop + d.abruptStopStd : null),
//         lower: filteredData.map(d => d.abruptStop !== null ? Math.max(0, d.abruptStop - d.abruptStopStd) : null),
//       },
//       vehicles: {
//         upper: filteredData.map(d => d.vehicles !== null ? d.vehicles + d.vehiclesStd : null),
//         lower: filteredData.map(d => d.vehicles !== null ? Math.max(0, d.vehicles - d.vehiclesStd) : null),
//       },
//     };
//   }, [filteredData]);

//   return (
//     <Box sx={{ width: '100%', px: 2}}>
//       <Typography variant="h6" gutterBottom sx={{ mt: 1 }}>
//         Aggressive Driving Behaviors Over Time
//       </Typography>

//       <LocalizationProvider dateAdapter={AdapterDayjs}>
//         <Box
//           sx={{
//             display: 'flex',
//             gap: 2,
//             justifyContent: 'center',
//             mb: 3,
//             mt: 2,
//           }}
//         >
//           <DatePicker
//             label="Start Date"
//             value={startDate}
//             onChange={(newValue) => {
//               if (!newValue) return;
//               if (endDate && newValue.isAfter(endDate)) return;
//               setStartDate(newValue);
//             }}
//             slotProps={{ textField: { size: 'small' } }}
//           />

//           <DatePicker
//             label="End Date"
//             value={endDate}
//             onChange={(newValue) => {
//               if (!newValue) return;
//               if (startDate && newValue.isBefore(startDate)) return;
//               setEndDate(newValue);
//             }}
//             slotProps={{ textField: { size: 'small' } }}
//           />
//         </Box>
//       </LocalizationProvider>

//       <LineChart
//         xAxis={[
//           {
//             data: filteredData.map(d => d.date),
//             scaleType: 'time',
//             tickMinStep: 24 * 60 * 60 * 1000,
//             valueFormatter: (value) =>
//               value.toLocaleDateString('en-US', {
//                 month: 'short',
//                 day: 'numeric',
//               }),
//           },
//         ]}
//         series={[
//           // Error band for Speeding (upper bound)
//           {
//             type: 'line',
//             data: errorBands.speeding.upper,
//             area: true,
//             baseline: 'min',
//             connectNulls: false,
//             showMark: false,
//             color: '#1976d2',
//             highlightScope: { highlight: 'none' },
//           },
//           // Error band for Speeding (lower bound - creates the band)
//           {
//             type: 'line',
//             data: errorBands.speeding.lower,
//             area: true,
//             baseline: 'min',
//             connectNulls: false,
//             showMark: false,
//             color: 'white',
//             highlightScope: { highlight: 'none' },
//           },
//           // Main Speeding line
//           {
//             data: filteredData.map(d => d.speeding),
//             label: 'Speeding',
//             connectNulls: false,
//             showMark: true,
//             color: '#1976d2',
//           },
          
//           // Error band for Swerving
//           {
//             type: 'line',
//             data: errorBands.swerving.upper,
//             area: true,
//             baseline: 'min',
//             connectNulls: false,
//             showMark: false,
//             color: '#dc004e',
//             highlightScope: { highlight: 'none' },
//           },
//           {
//             type: 'line',
//             data: errorBands.swerving.lower,
//             area: true,
//             baseline: 'min',
//             connectNulls: false,
//             showMark: false,
//             color: 'white',
//             highlightScope: { highlight: 'none' },
//           },
//           {
//             data: filteredData.map(d => d.swerving),
//             label: 'Swerving',
//             connectNulls: false,
//             showMark: true,
//             color: '#dc004e',
//           },
          
//           // Error band for Abrupt Stopping
//           {
//             type: 'line',
//             data: errorBands.abruptStop.upper,
//             area: true,
//             baseline: 'min',
//             connectNulls: false,
//             showMark: false,
//             color: '#ff9800',
//             highlightScope: { highlight: 'none' },
//           },
//           {
//             type: 'line',
//             data: errorBands.abruptStop.lower,
//             area: true,
//             baseline: 'min',
//             connectNulls: false,
//             showMark: false,
//             color: 'white',
//             highlightScope: { highlight: 'none' },
//           },
//           {
//             data: filteredData.map(d => d.abruptStop),
//             label: 'Abrupt Stopping',
//             connectNulls: false,
//             showMark: true,
//             color: '#ff9800',
//           },
          
//           // Error band for Vehicle Count
//           {
//             type: 'line',
//             data: errorBands.vehicles.upper,
//             area: true,
//             baseline: 'min',
//             connectNulls: false,
//             showMark: false,
//             color: '#4caf50',
//             highlightScope: { highlight: 'none' },
//           },
//           {
//             type: 'line',
//             data: errorBands.vehicles.lower,
//             area: true,
//             baseline: 'min',
//             connectNulls: false,
//             showMark: false,
//             color: 'white',
//             highlightScope: { highlight: 'none' },
//           },
//           {
//             data: filteredData.map(d => d.vehicles),
//             label: 'Vehicle Count',
//             connectNulls: false,
//             showMark: true,
//             color: '#4caf50',
//           },
//         ]}
//         height={300}
//         sx={{
//           '& .MuiLineElement-root': {
//             strokeWidth: 2,
//           },
//           '& .MuiAreaElement-root': {
//             fillOpacity: 0.2,
//           },
//         }}
//       />
//     </Box>
//   );
// }