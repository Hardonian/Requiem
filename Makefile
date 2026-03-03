# Requiem — Unified Build System
# ===============================
# Production-grade build orchestration with strict quality gates.

.PHONY: help install build test lint typecheck verify demo doctor clean

# Default target
.DEFAULT_GOAL := help

help: ## Show this help message
	@echo "Requiem — Unified Build System"
	@echo "==============================="
	@echo ""
	@echo "Installation:"
	@echo "  make install        Install all dependencies"
	@echo ""
	@echo "Build:"
	@echo "  make build          Build C++ engine and TypeScript packages"
	@echo "  make build:cpp      Build C++ engine only"
	@echo "  make build:web      Build web console only"
	@echo ""
	@echo "Verification:"
	@echo "  make verify         Run full verification suite"
	@echo "  make verify:cpp     Verify C++ engine"
	@echo "  make verify:web     Verify web console"
	@echo "  make verify:boundaries   Verify layer boundaries"
	@echo "  make verify:integrity    Verify CAS integrity"
	@echo "  make verify:policy       Verify policy enforcement"
	@echo "  make verify:replay       Verify replay exactness"
	@echo ""
	@echo "Quality Gates:"
	@echo "  make lint           Run linters"
	@echo "  make typecheck      Run TypeScript type checking"
	@echo "  make test           Run all tests"
	@echo "  make test:cpp       Run C++ tests only"
	@echo "  make test:web       Run web tests only"
	@echo ""
	@echo "Demo & Diagnostics:"
	@echo "  make demo           Run deterministic demo"
	@echo "  make doctor         Run system health check"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean          Clean build artifacts"
	@echo "  make format         Format code"

# ============================================================================
# Installation
# ============================================================================

install: ## Install all dependencies
	pnpm install
	cmake -S . -B build -DCMAKE_BUILD_TYPE=Release

# ============================================================================
# Build
# ============================================================================

build: build:cpp build:web ## Build everything

build:cpp: ## Build C++ engine
	cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
	cmake --build build -j

build:web: ## Build web console
	pnpm --filter ready-layer build

# ============================================================================
# Verification (Quality Gates)
# ============================================================================

verify: lint typecheck test verify:boundaries verify:integrity verify:policy verify:replay verify:web ## Full verification
	@echo "========================================"
	@echo "All verification gates passed"
	@echo "========================================"

verify:cpp: build:cpp ## Verify C++ engine
	ctest --test-dir build -C Release --output-on-failure

verify:web: ## Verify web console
	pnpm --filter ready-layer verify:web

verify:boundaries: ## Verify layer boundaries
	pnpm run verify:boundaries

verify:integrity: ## Verify CAS integrity
	pnpm --filter ready-layer verify:integrity

verify:policy: ## Verify policy enforcement
	pnpm --filter ready-layer verify:policy

verify:replay: ## Verify replay exactness
	pnpm --filter ready-layer verify:replay

# ============================================================================
# Quality Gates
# ============================================================================

lint: ## Run linters
	pnpm run lint

typecheck: ## Run TypeScript type checking
	pnpm run typecheck

test: test:cpp test:web ## Run all tests

test:cpp: build:cpp ## Run C++ tests
	ctest --test-dir build -C Release --output-on-failure -R "requiem_tests|kernel_tests|context_paging_test"

test:web: ## Run web tests
	pnpm --filter ready-layer test

# ============================================================================
# Demo & Diagnostics
# ============================================================================

demo: build:cpp ## Run deterministic demo
	@npx tsx scripts/demo-doctor.ts
	@npx tsx scripts/demo-run.ts

demo\:verify: build:cpp ## Run demo with replay verification
	@npx tsx scripts/demo-doctor.ts
	@npx tsx scripts/demo-run.ts
	@echo ""
	@echo "Verifying replay exactness..."
	@./build/Release/requiem.exe log verify --json

demo\:clean: ## Clean demo artifacts
	@echo "Cleaning demo artifacts..."
	@rm -rf demo_artifacts
	@mkdir -p demo_artifacts
	@echo "Demo artifacts cleaned."

doctor: ## Run system health check
	pnpm run doctor

# ============================================================================
# Maintenance
# ============================================================================

clean: ## Clean build artifacts
	rm -rf build
	rm -rf .next
	rm -rf ready-layer/.next
	pnpm --filter ready-layer exec rm -rf node_modules/.cache

format: ## Format code
	pnpm run format
