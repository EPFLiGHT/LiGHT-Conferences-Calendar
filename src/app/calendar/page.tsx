'use client';

import { Suspense, useState, useMemo, useRef } from 'react';
import {
  Box,
  Button,
  Container,
  Flex,
  Text,
} from '@chakra-ui/react';
import { Crosshair, Download } from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import luxonPlugin from '@fullcalendar/luxon3';
import { DateTime } from 'luxon';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ConferenceFiltersPanel from '@/components/ConferenceFiltersPanel';
import ConferenceModal from '@/components/ConferenceModal';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import { useConferences } from '@/hooks/useConferences';
import { useConferenceFilters, type ConferenceFiltersState } from '@/hooks/useConferenceFilters';
import { useURLSync, useInitialURLParams } from '@/utils/urlSync';
import { getEventColorFromSubjects, toISOFormat } from '@/utils/parser';
import { conferenceToICSEvents, createICSContent, downloadICS } from '@/utils/ics';
import { secondaryButtonStyle, primaryButtonStyle } from '@/styles/buttonStyles';
import type { Conference } from '@/types/conference';
import { EventClickArg } from '@fullcalendar/core';


function CalendarContent() {
  const calendarRef = useRef<FullCalendar>(null);
  const { conferences, loading, error } = useConferences();
  const initialParams = useInitialURLParams();
  const { syncFiltersToURL, syncSearchToURL } = useURLSync('/calendar');

  const [searchQuery, setSearchQuery] = useState<string>(initialParams.searchQuery);
  const [filters, setFilters] = useState<ConferenceFiltersState>({
    sortBy: 'deadline',
    year: initialParams.year,
    subject: initialParams.subject,
    type: initialParams.type,
  });
  const [selectedConference, setSelectedConference] = useState<Conference | null>(null);

  const handleFilterChange = (newFilters: Partial<ConferenceFiltersState>) => {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);
    syncFiltersToURL(searchQuery, updated);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    syncSearchToURL(query, filters);
  };

  // Use the centralized filtering hook instead of duplicating logic
  const filteredConferences = useConferenceFilters(conferences, searchQuery, filters);

  const calendarEvents = useMemo(() => {
    const events: any[] = [];

    filteredConferences.forEach(conf => {
      const eventColors = getEventColorFromSubjects(conf.sub);

      if (conf.start && conf.end) {
        events.push({
          id: `conf-${conf.id}`,
          title: `${conf.title} ${conf.year}`,
          start: conf.start,
          end: DateTime.fromISO(conf.end).plus({ days: 1 }).toISODate(),
          allDay: true,
          backgroundColor: eventColors.backgroundColor,
          borderColor: eventColors.borderColor,
          extendedProps: {
            type: 'conference',
            conference: conf,
          },
        });
      }

      if (conf.abstract_deadline) {
        const dt = DateTime.fromISO(toISOFormat(conf.abstract_deadline), { zone: conf.timezone });
        if (dt.isValid) {
          events.push({
            id: `abstract-${conf.id}`,
            title: `Abstract: ${conf.title} ${conf.year}`,
            start: dt.toISO(),
            end: dt.plus({ hours: 1 }).toISO(),
            allDay: false,
            backgroundColor: eventColors.backgroundColor,
            borderColor: eventColors.borderColor,
            extendedProps: {
              type: 'abstract',
              conference: conf,
              deadline: dt,
            },
          });
        }
      }

      if (conf.deadline) {
        const dt = DateTime.fromISO(toISOFormat(conf.deadline), { zone: conf.timezone });
        if (dt.isValid) {
          events.push({
            id: `deadline-${conf.id}`,
            title: `Submission: ${conf.title} ${conf.year}`,
            start: dt.toISO(),
            end: dt.plus({ hours: 1 }).toISO(),
            allDay: false,
            backgroundColor: eventColors.backgroundColor,
            borderColor: eventColors.borderColor,
            extendedProps: {
              type: 'submission',
              conference: conf,
              deadline: dt,
            },
          });
        }
      }
    });

    return events;
  }, [filteredConferences]);

  const handleEventClick = (info: EventClickArg) => {
    const conference = info.event.extendedProps.conference;
    setSelectedConference(conference);
  };

  const handleExportAll = () => {
    const allEvents = filteredConferences.flatMap(conferenceToICSEvents);
    const content = createICSContent(allEvents);
    downloadICS(content, 'conference-calendar.ics');
  };


  const handleToday = () => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.today();
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  return (
    <>
      <Header />
      <Box py={{ base: '6', md: '8' }} pb={{ base: '12', md: '16' }} minH="calc(100vh - 200px)">
        <Container maxW="1200px" px={{ base: '4', md: '6' }} mx="auto">
          <ConferenceFiltersPanel
            title="Conference Calendar"
            eyebrow="LiGHT · Calendar"
            description="View every tracked conference and its deadlines in a calendar. Click any event for details."
            searchValue={searchQuery}
            onSearchChange={handleSearchChange}
            conferences={conferences}
            filters={filters}
            onFilterChange={handleFilterChange}
          />

          <Flex
            align="center"
            justify="space-between"
            mb="6"
            pb="3"
            borderBottom="1px solid"
            borderColor="line.default"
            gap="3"
            flexWrap="wrap"
          >
            <Text
              fontSize="11px"
              color="brand.500"
              textTransform="uppercase"
              letterSpacing="0.22em"
              fontWeight="700"
              className="tabular"
            >
              {String(filteredConferences.length).padStart(2, '0')} conference{filteredConferences.length === 1 ? '' : 's'} tracked
            </Text>
            <Flex gap="2" flexWrap="wrap">
              <Button
                onClick={handleToday}
                size="sm"
                px="4"
                {...secondaryButtonStyle}
              >
                <Flex align="center" gap="2">
                  <Crosshair size={13} strokeWidth={1.75} />
                  <span>Today</span>
                </Flex>
              </Button>
              <Button
                onClick={handleExportAll}
                size="sm"
                px="4"
                {...primaryButtonStyle}
              >
                <Flex align="center" gap="2">
                  <Download size={13} strokeWidth={1.75} />
                  <span>Export All</span>
                </Flex>
              </Button>
            </Flex>
          </Flex>

          <Box
            bg="white"
            border="1px solid"
            borderColor="line.default"
            borderRadius="4px"
            p={{ base: '4', md: '6' }}
          >
            <style>{`
              .fc-event {
                margin-bottom: 4px !important;
              }
              .fc-daygrid-event {
                margin-bottom: 4px !important;
              }
              .fc-timegrid-event {
                margin-bottom: 6px !important;
              }
            `}</style>
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin, luxonPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: 'prev,next',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,listMonth',
              }}
              events={calendarEvents}
              eventClick={handleEventClick}
              height="auto"
              timeZone="local"
              eventTimeFormat={{
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              }}
              eventDisplay="block"
              displayEventTime={true}
              displayEventEnd={true}
              dayMaxEvents={false}
              eventMaxStack={10}
            />
          </Box>

          {selectedConference && (
            <ConferenceModal
              conference={selectedConference}
              onClose={() => setSelectedConference(null)}
            />
          )}
        </Container>
      </Box>
      <Footer />
    </>
  );
}

export default function Calendar() {
  return (
    <Suspense fallback={<LoadingState />}>
      <CalendarContent />
    </Suspense>
  );
}
