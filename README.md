# FRC Scouting Dashboard

A comprehensive, single-page web application designed for FIRST Robotics Competition (FRC) teams. This dashboard handles pit scouting, data aggregation, and alliance selection strategy in a fully responsive, offline-capable environment. 

The application is built as a "white-label" template. Any FRC team can deploy this system and easily rebrand it to match their team identity.

## Key Features

* **Offline-First Architecture:** Built to survive unreliable FRC event cell networks. Scouters can log data and capture robot photos completely offline. The app queues the payloads locally and automatically pushes them to the server the moment a connection is reestablished.
* **Alliance Selection Engine:** A dedicated draft board that tracks live event rankings from The Blue Alliance. Features automatic captain-shifting logic and draft exclusion rules.
* **Strategy War Room:** A drag-and-drop ranking interface allowing strategists to build custom picklists using merged data from Statbotics (EPA) and Lovat match averages.
* **Role-Based Access Control:** Secure permissions structure restricting access based on user roles (Scouter, Strategist, Drive Coach, Admin, Master Owner).
* **Automated Data Sync:** Automatically pulls live event rosters and rankings from The Blue Alliance, and parses EPA metrics from the Statbotics API.

## Tech Stack

* **Frontend:** Vanilla HTML, CSS, and JavaScript (Zero build steps or bundlers required).
* **Backend / Database:** [Supabase](https://supabase.com/) (PostgreSQL, Authentication, and Cloud Storage).
* **Data Tables:** [Tabulator.js](https://tabulator.info/) for high-performance, sortable, drag-and-drop data grids.

## User Roles & Permissions

The application restricts views based on the user's assigned role in the database. Roles are assigned by the Master Owner inside the Admin Dashboard tab.

* **Scouter:** Can only view their assigned tasks and submit Pit Scouting forms.
* **Strategist & Drive Coach:** Gains access to the global Team Data roster, the Alliance Draft Board, and the War Room ranking tools.
* **Admin / Owner:** Full access to all tools, plus the Admin Dashboard to manage event TBA keys, automatically dispatch team assignments, wipe databases, and alter user permissions.
