const { Client } = require('pg'); const client = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' }); client.connect().then(() => client.query(\
SELECT
*
FROM
public.quests
WHERE
title
=
Subtask 4
\)).then(res => console.log(res.rows)).finally(() => client.end());
