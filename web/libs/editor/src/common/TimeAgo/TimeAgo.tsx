import { format, formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import { zhCN } from "date-fns/locale/zh-CN";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SECS = 1000;
const MINS = 60 * SECS;

// Each stage is a tuple of limit and step
// limit is a time from base date, until which stage is active.
// step is a time-step which we do between two adjusted ticks.
// stages are chosen to match formatDistanceToNow function from date-fns
const STAGES: [limit: number, step: number][] = [
  // from 0 seconds
  [30 * SECS, 30 * SECS], // to 30 seconds with 30 seconds step
  [44 * MINS + 30 * SECS, MINS], // to 44 minutes 30 seconds with 1 minute step
  [Number.MAX_SAFE_INTEGER, 30 * MINS], // to 30 seconds with 30 seconds step
];

function getNextTick(passedTime = 0) {
  const idx = STAGES.findIndex(([timeLimit], idx) => {
    return timeLimit > passedTime || idx === STAGES.length - 1;
  });
  const baseLimit = idx > 0 ? STAGES[idx - 1][0] : 0;
  const baseStep = STAGES[idx][1];

  return Math.ceil((passedTime - baseLimit + 1) / baseStep) * baseStep + baseLimit;
}

type TimeAgoProps = React.ComponentPropsWithoutRef<"time"> & {
  date: number | string | Date;
};

const getTimeAgoLocale = () => {
  if (typeof window === "undefined") return { locale: enUS, isZh: false };
  const lng = (window as { __LABELSTUDIO_I18N__?: { language?: string } }).__LABELSTUDIO_I18N__?.language;
  const isZh = lng === "zh";
  return { locale: isZh ? zhCN : enUS, isZh };
};

export const TimeAgo = ({ date, ...rest }: TimeAgoProps) => {
  const [timestamp, forceUpdate] = useState(Date.now());
  const fromTS = useMemo(() => {
    return new Date(date).valueOf();
  }, [date]);
  const timeoutId = useRef<number>();
  const scheduleNext = useCallback(() => {
    const passedTime = Date.now() - fromTS;
    const tickValue = getNextTick(passedTime);

    timeoutId.current = window.setTimeout(() => {
      forceUpdate(Date.now());
    }, tickValue - passedTime);
  }, [date]);

  useEffect(() => {
    scheduleNext();
    return () => {
      clearTimeout(timeoutId.current);
    };
  }, [date, timestamp]);

  const { locale, isZh } = getTimeAgoLocale();
  let text = formatDistanceToNow(fromTS, { addSuffix: true, locale });
  // Shorter phrasing in English only; Chinese uses date-fns zhCN wording (e.g. 不到 1 分钟前).
  if (!isZh && text === "less than a minute ago") {
    text = "seconds ago";
  }

  return (
    <time
      dateTime={format(fromTS, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx")}
      title={format(fromTS, "PPpp", { locale })}
      {...rest}
    >
      {text}
    </time>
  );
};
