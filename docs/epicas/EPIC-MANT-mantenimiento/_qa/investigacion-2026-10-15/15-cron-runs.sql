select jobid, status, start_time, end_time, left(return_message,80) as msg from cron.job_run_details where start_time between '2026-10-11T15:44:50Z' and '2026-10-11T15:45:40Z' order by start_time
