UPDATE daily_totals SET
  search_found = COALESCE((SELECT COUNT(*) FROM events
    WHERE events.day = daily_totals.day AND events.type = 'search'
      AND json_extract(events.payload, '$.found') = 1), 0),
  city_calcs = COALESCE((SELECT COUNT(*) FROM events
    WHERE events.day = daily_totals.day AND events.type = 'calc'
      AND json_extract(events.payload, '$.mode') = 'city'), 0),
  point_calcs = COALESCE((SELECT COUNT(*) FROM events
    WHERE events.day = daily_totals.day AND events.type = 'calc'
      AND json_extract(events.payload, '$.mode') = 'point'), 0),
  cache_hits = COALESCE((SELECT COUNT(*) FROM events
    WHERE events.day = daily_totals.day AND events.type = 'calc'
      AND json_extract(events.payload, '$.fromCache') = 1), 0);
