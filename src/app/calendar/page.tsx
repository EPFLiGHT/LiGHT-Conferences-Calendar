'use client';

import { Suspense, useState, useMemo, useRef } from 'react';
import { Box, Button, Flex, Text } from '@chakra-ui/react';
import { Crosshair, Download } from 'lucide-react';
import FullCalendar, {
  joinClassNames,
  type CalendarRef,
  type EventClickInfo,
  type EventInput,
} from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import listPlugin from '@fullcalendar/react/list';
import classicThemePlugin from '@fullcalendar/react/themes/classic';
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/theme.css';
import '@fullcalendar/react/themes/classic/palette.css';
import { DateTime } from 'luxon';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageShell from '@/components/PageShell';
import ConferenceFiltersPanel from '@/components/ConferenceFiltersPanel';
import ConferenceModal from '@/components/ConferenceModal';
import { LoadingState, ErrorState } from '@/components/StatusScreen';
import { countLabel } from '@/components/format';
import { useConferences } from '@/hooks/useConferences';
import { useConferenceFilters } from '@/hooks/useConferenceFilters';
import { useConferenceFilterState } from '@/hooks/useConferenceFilterState';
import { getDeadlineInfo, getEventColor } from '@/utils/parser';
import { conferenceToICSEvents, createICSContent, downloadICS } from '@/utils/ics';
import { secondaryButtonStyle, primaryButtonStyle } from '@/styles/buttonStyles';
import { cardSurfaceStyle } from '@/styles/containerStyles';
import type { Conference } from '@/types/conference';

// Stable references, so FullCalendar does not reprocess options on every render.
const PLUGINS = [classicThemePlugin, dayGridPlugin, timeGridPlugin, listPlugin];

const HEADER_TOOLBAR = {
  left: 'prev,next',
  center: 'title',
  right: 'dayGridMonth,timeGridWeek,listMonth',
};

const SHORT_DEADLINE_LABEL = { abstract: 'Abstract', paper: 'Submission' } as const;

const EVENT_TIME_FORMAT = {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
} as const;

const VIEWS = {
  dayGridMonth: { displayEventTime: false },
  timeGridWeek: {
    titleFormat: { year: 'numeric', month: 'short', day: 'numeric' },
    dayHeaderFormat: { weekday: 'short', month: 'numeric', day: 'numeric', omitCommas: true },
  },
} as const;

const buttonClass = (info: { isSelected: boolean }) =>
  joinClassNames('cal-button', info.isSelected && 'cal-button-active');

const dayCellTopInnerClass = (info: { isToday: boolean }) =>
  joinClassNames('cal-day-number', info.isToday && 'cal-day-number-today');

function CalendarContent() {
  const calendarRef = useRef<CalendarRef>(null);
  const { conferences, loading, error } = useConferences();
  const { searchQuery, filters, setSearchQuery, updateFilters, resetFilters } = useConferenceFilterState();
  const [selectedConference, setSelectedConference] = useState<Conference | null>(null);

  const filteredConferences = useConferenceFilters(conferences, searchQuery, filters);

  const calendarEvents = useMemo(
    () =>
      filteredConferences.flatMap((conf): EventInput[] => {
        const color = getEventColor(conf.sub);
        const extendedProps = { conference: conf };
        const events: EventInput[] = getDeadlineInfo(conf).map((deadline) => ({
          id: `${deadline.kind}-${conf.id}`,
          title: `${SHORT_DEADLINE_LABEL[deadline.kind]}: ${conf.title} ${conf.year}`,
          start: deadline.datetime.toISO() ?? undefined,
          end: deadline.datetime.plus({ hours: 1 }).toISO() ?? undefined,
          allDay: false,
          color,
          extendedProps,
        }));
        if (conf.start && conf.end) {
          events.unshift({
            id: `conf-${conf.id}`,
            title: `${conf.title} ${conf.year}`,
            start: conf.start,
            end: DateTime.fromISO(conf.end).plus({ days: 1 }).toISODate() ?? undefined,
            allDay: true,
            color,
            extendedProps,
          });
        }
        return events;
      }),
    [filteredConferences]
  );

  const handleEventClick = (info: EventClickInfo) => {
    setSelectedConference(info.event.extendedProps.conference);
  };

  const handleExportAll = () => {
    const allEvents = filteredConferences.flatMap(conferenceToICSEvents);
    downloadICS(createICSContent(allEvents), 'conference-calendar.ics');
  };

  const handleToday = () => {
    calendarRef.current?.getApi().today();
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  return (
    <>
      <Header />
      <PageShell>
          <ConferenceFiltersPanel
            title="Events Calendar"
            eyebrow="LiGHT · Calendar"
            description="View every tracked event and its deadlines in a calendar. Click any event for details."
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            conferences={conferences}
            filters={filters}
            onFilterChange={updateFilters}
            onReset={resetFilters}
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
            <Text textStyle="eyebrow" color="brand.500" className="tabular">
              {countLabel(filteredConferences.length, 'conference')} tracked
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

          <Box {...cardSurfaceStyle} p={{ base: '4', md: '6' }}>
            <FullCalendar
              ref={calendarRef}
              plugins={PLUGINS}
              initialView="dayGridMonth"
              headerToolbar={HEADER_TOOLBAR}
              events={calendarEvents}
              eventClick={handleEventClick}
              height="auto"
              timeZone="local"
              eventTimeFormat={EVENT_TIME_FORMAT}
              eventDisplay="block"
              displayEventEnd={true}
              allDayText="all-day"
              views={VIEWS}
              dayMaxEvents={false}
              eventMaxStack={10}
              className="cal"
              toolbarClass="cal-toolbar"
              toolbarSectionClass="cal-toolbar-section"
              toolbarTitleClass="cal-title"
              buttonClass={buttonClass}
              dayHeaderClass="cal-day-header"
              dayHeaderInnerClass="cal-day-header-text"
              dayCellTopInnerClass={dayCellTopInnerClass}
              eventClass="cal-event"
              rowEventClass="cal-block-event"
              rowEventInnerClass="cal-event-inner"
              rowEventTitleClass="cal-event-inner"
              columnEventClass="cal-block-event"
              columnEventTimeClass="cal-column-event-text cal-column-event-time"
              columnEventTitleClass="cal-column-event-text"
              listDayHeaderClass="cal-list-day"
              listDayHeaderInnerClass="cal-list-day-text"
              listItemEventClass="cal-list-event"
              listItemEventTimeClass="cal-list-event-text cal-list-event-time"
              listItemEventTitleClass="cal-list-event-text"
            />
          </Box>

          {selectedConference && (
            <ConferenceModal
              conference={selectedConference}
              onClose={() => setSelectedConference(null)}
            />
          )}
      </PageShell>
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
