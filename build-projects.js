#!/usr/bin/env node
/**
 * Build script to fetch GitHub projects and inject them into index.html
 * Run this script during build/deploy to update project data.
 * 
 * Usage: node build-projects.js
 * 
 * Can be run via GitHub Actions with a daily cron schedule.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GITHUB_USERNAME = 'rgilks';
const GITHUB_API_URL = `https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=100`;
const INDEX_FILE = path.join(__dirname, 'index.html');

// Projects to exclude from display
const EXCLUDED_REPOS = [];

// Maximum number of projects to display
const MAX_PROJECTS = 12;

async function fetchProjects() {
    console.log('Fetching projects from GitHub API...');
    
    const headers = {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'tre-website-static'
    };

    // Use GITHUB_TOKEN if available (for GitHub Actions)
    if (process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }

    const response = await fetch(GITHUB_API_URL, { headers });
    
    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const repos = await response.json();
    
    // Filter and transform repos
    const projects = repos
        .filter(repo => !repo.private && !EXCLUDED_REPOS.includes(repo.name))
        .slice(0, MAX_PROJECTS)
        .map((repo, index) => ({
            name: repo.name,
            description: repo.description || 'No description available',
            htmlUrl: repo.html_url,
            homepageUrl: repo.homepage || null,
            updatedAt: repo.updated_at,
            isHighlighted: index === 0
        }));

    console.log(`Found ${projects.length} projects`);
    return projects;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function generateProjectCard(project) {
    const highlightedClass = project.isHighlighted ? ' project-card-highlighted' : '';
    const linksClass = project.homepageUrl ? '' : ' project-links-full';
    const btnClass = project.homepageUrl ? '' : ' project-btn-full';
    
    const websiteLink = project.homepageUrl ? `
                                        <a href="${project.homepageUrl}" target="_blank" rel="noopener noreferrer" class="project-btn" data-testid="project-website">
                                            <div class="btn-fill"></div>
                                            <span class="btn-text">Website</span>
                                        </a>` : '';

    return `
                        <!-- Project Card: ${project.name} -->
                        <div class="project-card${highlightedClass}" data-testid="project-card">
                            <div class="project-card-bg"></div>
                            <div class="project-card-content">
                                <div class="project-header">
                                    <h3 class="project-title" data-testid="project-title">${project.name}</h3>
                                    <p class="project-description" data-testid="project-description">${escapeHtml(project.description)}</p>
                                </div>
                                <div class="project-footer">
                                    <div class="project-date">
                                        <svg class="date-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                            <line x1="16" y1="2" x2="16" y2="6"></line>
                                            <line x1="8" y1="2" x2="8" y2="6"></line>
                                            <line x1="3" y1="10" x2="21" y2="10"></line>
                                        </svg>
                                        <span data-testid="project-updated">${formatDate(project.updatedAt)}</span>
                                    </div>
                                    <div class="project-links${linksClass}">${websiteLink}
                                        <a href="${project.htmlUrl}" target="_blank" rel="noopener noreferrer" class="project-btn${btnClass}" data-testid="project-github">
                                            <div class="btn-fill"></div>
                                            <span class="btn-text">GitHub</span>
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>`;
}

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function generateProjectsHtml(projects) {
    return projects.map(generateProjectCard).join('\n');
}

async function updateIndexHtml(projectsHtml) {
    console.log('Updating index.html...');
    
    const html = fs.readFileSync(INDEX_FILE, 'utf8');
    
    // Find and replace the project grid content
    // Look for the project-grid div and replace its contents
    const gridStartRegex = /<div class="project-grid"[^>]*data-testid="project-grid"[^>]*>/;
    const gridEndMarker = '</div>\n                </div>\n            </section>\n\n            <!-- About Section -->';
    
    const startMatch = html.match(gridStartRegex);
    if (!startMatch) {
        throw new Error('Could not find project-grid in index.html');
    }
    
    const startIndex = startMatch.index + startMatch[0].length;
    const endIndex = html.indexOf(gridEndMarker);
    
    if (endIndex === -1) {
        throw new Error('Could not find end of project-grid in index.html');
    }
    
    // Replace the content between start and end
    const newHtml = html.slice(0, startIndex) + '\n' + projectsHtml + '\n                    ' + html.slice(endIndex);
    
    fs.writeFileSync(INDEX_FILE, newHtml);
    console.log('index.html updated successfully!');
}

async function main() {
    try {
        const projects = await fetchProjects();
        const projectsHtml = generateProjectsHtml(projects);
        await updateIndexHtml(projectsHtml);
        console.log('Build complete!');
    } catch (error) {
        console.error('Build failed:', error.message);
        process.exit(1);
    }
}

main();
