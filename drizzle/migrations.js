// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_init.sql';
import m0001 from './0001_seed_exercises.sql';
import m0002 from './0002_flowery_rick_jones.sql';
import m0003 from './0003_jazzy_starhawk.sql';
import m0004 from './0004_seed_muscle_groups.sql';
import m0005 from './0005_supreme_doctor_octopus.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005
    }
  }
  