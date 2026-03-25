# Milestones

## M0: Planning and setup

Goal:
- establish the repo, tooling, environment contracts, and architecture documents

Done when:
- the monorepo structure exists
- the web app runs locally
- the data workspace dependencies are defined
- the core architecture decisions are written down

## M1: Data foundation

Goal:
- ingest reference F1 data and load the first normalized schema into Supabase

Deliverables:
- ingestion scripts
- seed or migration SQL
- first curated tables for drivers, constructors, circuits, races, and results

## M2: Backend core APIs

Goal:
- expose typed routes for reference data and user scenario inputs

Deliverables:
- drivers/constructors/circuits/races endpoints
- validation layer
- simulation request contracts

## M3: Frontend UI shell

Goal:
- build the premium app shell, landing experience, and navigation

Deliverables:
- branded layout
- responsive navigation
- homepage sections
- module entry points

## M4: Race Prediction Lab

Goal:
- ship the first useful race simulation workflow

Deliverables:
- scenario form
- deterministic + heuristic race engine
- finishing-order and podium outputs
- explanation layer

## M5: Fantasy Team Builder

Goal:
- ship fantasy lineup recommendations users can actually compare

Deliverables:
- lineup constraints form
- optimization engine
- safe, balanced, aggressive outputs
- rationale per pick

## M6: Charts and polish

Goal:
- make the product feel premium and analytics-heavy

Deliverables:
- charts
- comparison views
- loading and error states
- mobile polish

## M7: Deployment

Goal:
- deploy the full stack on free hosting

Deliverables:
- Vercel deployment
- Supabase production config
- scheduled GitHub Action refreshes
- environment documentation

## M8: Resume and portfolio packaging

Goal:
- make the project recruiter-ready

Deliverables:
- polished README
- architecture diagram
- resume bullets
- screenshots and writeup
