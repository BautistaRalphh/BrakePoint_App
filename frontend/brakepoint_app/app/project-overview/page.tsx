'use client';

import { AppBar, Toolbar, Box, Button, Typography, Avatar, Divider, Paper } from '@mui/material';
import Link from 'next/link';

const members = [
  {
    name: 'Ysabela Erika Alvarez',
    role: 'HXIL Student Researcher',
    focus: 'Frontend',
    photo: null,
  },
  {
    name: 'Ralph Gabriel Bautista',
    role: 'HXIL Student Researcher',
    focus: 'Fullstack',
    photo: '/photos/2.jpg',
  },
  {
    name: 'Julianna Victoria Brizuela',
    role: 'HXIL Student Researcher',
    focus: 'Frontend',
    photo: null,
  },
  {
    name: 'Joemar Lapasaran',
    role: 'HXIL Student Researcher',
    focus: 'Backend',
    photo: '/photos/4.jpg',
  },
];

export default function ProjectOverviewPage() {
  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="sticky" sx={{ backgroundColor: '#161b4cff' }}>
        <Toolbar sx={{ marginLeft: 'auto', mr: 6.5, display: 'flex', gap: 1 }}>
          <Button color="inherit" component={Link} href="/home">Home</Button>
          <Button color="inherit" component={Link} href="/project-overview">Project Overview</Button>
          <Button color="inherit" component={Link} href="/logIn">Login</Button>
          <Button color="inherit" component={Link} href="/signUp">Sign Up</Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ mt: 8, px: 8 }}>
        <Typography variant="h4" sx={{ mb: 3, fontWeight: 600 }}>
          Project Overview
        </Typography>

        <Typography variant="body1" sx={{ mb: 2, color: 'text.secondary', maxWidth: 860 }}>
          BrakePoint is an undergraduate thesis project developed at De La Salle University under
          the Human Experience and Interaction Laboratory (HXIL). The system leverages computer
          vision and machine learning to detect and analyze aggressive driving behaviors, including
          speeding, swerving, and abrupt stopping, from road-mounted camera footage.
        </Typography>
        <Typography variant="body1" sx={{ mb: 2, color: 'text.secondary', maxWidth: 860 }}>
          Using a custom-trained YOLOv8 model for vehicle detection and a Mask R-CNN (Detectron2)
          model for traffic sign recognition, BrakePoint processes video feeds and generates
          structured insights that road safety engineers and urban planners can use to identify
          high-risk zones, monitor traffic flow, and prioritize infrastructure improvements.
        </Typography>
        <Typography variant="body1" sx={{ mb: 5, color: 'text.secondary', maxWidth: 860 }}>
          The platform provides an interactive map interface for defining areas of interest,
          attaching cameras, uploading footage, and reviewing per-location analytics, all within
          a single, unified web application.
        </Typography>

        <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
          Thesis Adviser
        </Typography>
        <Paper
          variant="outlined"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 2, px: 3, py: 2, borderRadius: 3, mb: 6 }}
        >
          <Avatar sx={{ width: 56, height: 56, bgcolor: '#161b4c', fontSize: 20 }}>BS</Avatar>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Briane Paul Samson, Ph.D.
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Thesis Adviser</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Head of HXIL — De La Salle University</Typography>
          </Box>
        </Paper>

        <Divider sx={{ mb: 5 }} />

        <Typography variant="h5" sx={{ mb: 4, fontWeight: 600 }}>
          Meet the Team
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'row', gap: 5, flexWrap: 'wrap', pb: 10 }}>
          {members.map((member) => (
            <Box
              key={member.name}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: 180,
                gap: 1.5,
              }}
            >

              <Avatar
                src={member.photo ?? undefined}
                alt={member.name}
                sx={{ width: 120, height: 120, bgcolor: '#161b4c', fontSize: 36 }}
              >
                {member.photo ? null : member.name.charAt(0)}
              </Avatar>
              <Typography variant="subtitle2" align="center" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                {member.name}
              </Typography>
              <Typography variant="caption" align="center" sx={{ color: 'text.secondary', lineHeight: 1.3 }}>
                {member.role}
              </Typography>
              <Typography variant="caption" align="center" sx={{ color: '#161b4c', fontWeight: 600 }}>
                {member.focus}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
