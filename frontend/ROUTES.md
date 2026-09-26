Complete Route List
GET    /api/v1/health

POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/auth/me

GET    /api/v1/run/:slug
POST   /api/v1/run/:slug/sessions
PATCH  /api/v1/run/sessions/:sessionId
POST   /api/v1/run/sessions/:sessionId/trials
POST   /api/v1/run/sessions/:sessionId/complete
POST   /api/v1/run/sessions/:sessionId/beacon
DELETE /api/v1/run/withdraw/:withdrawCode

GET    /api/v1/experiments
POST   /api/v1/experiments
GET    /api/v1/experiments/:id
PUT    /api/v1/experiments/:id
DELETE /api/v1/experiments/:id
POST   /api/v1/experiments/:id/duplicate
POST   /api/v1/experiments/:id/publish

POST   /api/v1/stimuli/upload-url
POST   /api/v1/stimuli
GET    /api/v1/stimuli
DELETE /api/v1/stimuli/:id

GET    /api/v1/results/:experimentId/summary
GET    /api/v1/results/:experimentId/sessions
GET    /api/v1/results/:experimentId/sessions/:sessionId
PATCH  /api/v1/results/:experimentId/sessions/:sessionId
GET    /api/v1/results/:experimentId/export?format=csv|json