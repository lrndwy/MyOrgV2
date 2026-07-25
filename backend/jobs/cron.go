package jobs

import (
	"context"
	"log"
	"time"

	"backend/services"

	"github.com/lrndwy/gokil/cron"
)

func CronJobs() []cron.Job {
	return []cron.Job{
		{
			Name:       "event_status_transition",
			Every:      1 * time.Minute,
			RunOnStart: true,
			Run: func(ctx context.Context) error {
				return services.EventService{}.TransitionStatuses(ctx)
			},
		},
	}
}

func RunCron(ctx context.Context) error {
	logger := log.Default()
	return cron.Runner{
		Jobs:   CronJobs(),
		Logger: logger,
		OnError: func(job cron.Job, err error) {
			logger.Printf("cron job %q error: %v", job.Name, err)
		},
	}.Run(ctx)
}
