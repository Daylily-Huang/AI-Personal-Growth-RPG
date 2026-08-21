const { Client } = require('pg'); const client = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' }); client.connect().then(() => client.query(\
SELECT
trigger_name
FROM
information_schema.triggers
WHERE
event_object_table
=
quests
\)).then(res => console.log(res.rows)).finally(() => client.end());
