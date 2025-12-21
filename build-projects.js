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

// Image patterns to exclude (badges, stats, avatars, etc.)
const EXCLUDED_IMAGE_HANDLES = [
    'img.shields.io',
    'badge.svg',
    'github-readme-stats',
    'github-readme-streak-stats',
    'github-profile-summary-cards',
    'ko-fi.com',
    'buy-me-a-coffee',
    'paypal.me',
    'avatars.githubusercontent.com',
    'contrib.rocks',
    'license',
    'twitter.svg',
    'linkedin.svg'
];

// Maximum number of projects to display
const MAX_PROJECTS = 100;

async function fetchReadme(repoName, defaultBranch, headers) {
    const readmeUrl = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${repoName}/${defaultBranch}/README.md`;
    try {
        const response = await fetch(readmeUrl, { headers });
        if (response.ok) {
            return await response.text();
        }
    } catch (error) {
        console.warn(`Could not fetch README for ${repoName}:`, error.message);
    }
    return null;
}

function extractFirstImage(readmeContent, repoName, defaultBranch) {
    if (!readmeContent) return null;

    // Matches both Markdown and HTML image tags
    const markdownImageRegex = /!\[.*?\]\((.*?)\)/g;
    const htmlImageRegex = /<img.*?src=["'](.*?)["'].*?>/g;
    
    let match;
    const imageUrls = [];

    // Extract Markdown images
    while ((match = markdownImageRegex.exec(readmeContent)) !== null) {
        imageUrls.push(match[1]);
    }

    // Extract HTML images
    while ((match = htmlImageRegex.exec(readmeContent)) !== null) {
        imageUrls.push(match[1]);
    }

    // Filter out badges, logos, contributor avatars, and other unwanted images
    const filteredImages = imageUrls.filter(url => {
        const lowerUrl = url.toLowerCase();
        return !EXCLUDED_IMAGE_HANDLES.some(domain => lowerUrl.includes(domain));
    });

    if (filteredImages.length === 0) return null;

    let firstImage = filteredImages[0];

    // Resolve relative paths
    if (!firstImage.startsWith('http')) {
        // Remove leading ./ or / if present
        firstImage = firstImage.replace(/^(\.\/|\/)/, '');
        firstImage = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${repoName}/${defaultBranch}/${firstImage}`;
    }

    return firstImage;
}

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
    const projects = [];
    
    // Use a subset of projects for efficiency or the full list
    const filteredRepos = repos
        .filter(repo => !repo.private && !EXCLUDED_REPOS.includes(repo.name))
        .slice(0, MAX_PROJECTS);

    for (const [index, repo] of filteredRepos.entries()) {
        console.log(`Processing ${repo.name}...`);
        const readmeContent = await fetchReadme(repo.name, repo.default_branch, headers);
        const imageUrl = extractFirstImage(readmeContent, repo.name, repo.default_branch);

        projects.push({
            name: repo.name,
            description: repo.description || 'No description available',
            htmlUrl: repo.html_url,
            homepageUrl: repo.homepage || null,
            updatedAt: repo.updated_at,
            homepageUrl: repo.homepage || null,
            updatedAt: repo.updated_at,
            imageUrl: imageUrl,
            topics: repo.topics || []
        });
    }

    console.log(`Found ${projects.length} projects`);
    return projects;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function generateProjectCard(project) {
    const linksClass = project.homepageUrl ? '' : ' project-links-full';
    const btnClass = project.homepageUrl ? '' : ' project-btn-full';
    
    const websiteLink = project.homepageUrl ? `
                                         <a href="${project.homepageUrl}" target="_blank" rel="noopener noreferrer" class="project-btn" data-testid="project-website">
                                             <div class="btn-fill"></div>
                                             <span class="btn-text">Website</span>
                                         </a>` : '';

    const imageHtml = project.imageUrl ? `
                                 <div class="project-image-container">
                                     <img src="${project.imageUrl}" alt="${project.name} screenshot" class="project-image" loading="lazy">
                                 </div>` : `
                                 <div class="project-image-container placeholder">
                                     <div class="placeholder-overlay"></div>
                                     <svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                         <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                         <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                         <polyline points="21 15 16 10 5 21"></polyline>
                                     </svg>
                                 </div>`;

    const randomDelay = (Math.random() * -10).toFixed(2); // Random start time for animations
    const projectLink = project.homepageUrl || project.htmlUrl;
    
    return `
                        <!-- Project Card: ${project.name} -->
                        <div class="project-card" data-testid="project-card">
                            <div class="project-card-bg"></div>
                            <div class="project-image-wrapper" style="--anim-delay: ${randomDelay}s">
                                <a href="${projectLink}" target="_blank" rel="noopener noreferrer" class="project-image-link">
                                    ${imageHtml}
                                </a>
                            </div>
                            <div class="project-card-content">
                                <div class="project-header">
                                    <h3 class="project-title" data-testid="project-title">${project.name}</h3>
                                    <p class="project-description" data-testid="project-description">${escapeHtml(project.description)}</p>
                                </div>
                                <div class="project-topics">
                                    ${project.topics.slice(0, 6).map(topic => `<span class="topic-tag">${topic}</span>`).join('')}
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
