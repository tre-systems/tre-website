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

const GITHUB_ORG = 'tre-systems';
const GITHUB_API_URL = `https://api.github.com/orgs/${GITHUB_ORG}/repos?type=all&sort=pushed&per_page=100`;
const INDEX_FILE = path.join(__dirname, 'index.html');
const PRIVATE_PROJECT_IMAGE_DIR = path.join(__dirname, 'generated', 'project-images');

// Projects to exclude from display
const EXCLUDED_REPOS = ['tre-website'];

// Flagship portfolio work to show first. Metadata still comes from GitHub.
const FLAGSHIP_REPOS = ['writeo', 'antenna', 'acto'];
const APPROVED_PRIVATE_PROJECT_HOSTS = new Set([
    'rowspire.com',
    'www.rowspire.com'
]);

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
    'linkedin.svg',
    'via.placeholder.com',
    'placehold.co'
];

// Maximum number of projects to display
const MAX_PROJECTS = 100;

function getAuthToken() {
    return process.env.PROJECTS_GITHUB_TOKEN || process.env.GITHUB_TOKEN || null;
}

function createHeaders(accept = 'application/vnd.github+json') {
    const headers = {
        'Accept': accept,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'tre-website-static'
    };

    const token = getAuthToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
}

async function fetchReadme(repoName, headers) {
    const readmeUrl = `https://api.github.com/repos/${GITHUB_ORG}/${repoName}/readme`;
    try {
        const response = await fetch(readmeUrl, {
            headers: {
                ...headers,
                'Accept': 'application/vnd.github.raw'
            }
        });
        if (response.ok) {
            return await response.text();
        }
    } catch (error) {
        console.warn(`Could not fetch README for ${repoName}:`, error.message);
    }
    return null;
}

function isPublicPortfolioUrl(url) {
    if (!url) return false;

    try {
        const { hostname } = new URL(url);
        return (
            hostname === 'tre.systems' ||
            hostname.endsWith('.tre.systems') ||
            APPROVED_PRIVATE_PROJECT_HOSTS.has(hostname)
        );
    } catch {
        return false;
    }
}

function cachedPrivateProjectImage(repoName) {
    for (const extension of ['.png', '.jpg', '.webp', '.gif', '.svg']) {
        const relativePath = `generated/project-images/${repoName}${extension}`;
        if (fs.existsSync(path.join(__dirname, relativePath))) {
            return relativePath;
        }
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
        firstImage = `https://raw.githubusercontent.com/${GITHUB_ORG}/${repoName}/${defaultBranch}/${firstImage}`;
    }

    return firstImage;
}

function imageExtensionFromUrl(url) {
    try {
        const ext = path.extname(new URL(url).pathname).toLowerCase();
        if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(ext)) {
            return ext === '.jpeg' ? '.jpg' : ext;
        }
    } catch {
        // Fall through to the default.
    }
    return '.png';
}

async function cachePrivateProjectImage(repoName, imageUrl, headers) {
    fs.mkdirSync(PRIVATE_PROJECT_IMAGE_DIR, { recursive: true });

    const response = await fetch(imageUrl, { headers });
    if (!response.ok) {
        throw new Error(`Could not fetch private image for ${repoName}: ${response.status} ${response.statusText}`);
    }

    const extension = imageExtensionFromUrl(imageUrl);
    const filename = `${repoName}${extension}`;
    const outputPath = path.join(PRIVATE_PROJECT_IMAGE_DIR, filename);
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(outputPath, imageBuffer);

    return `generated/project-images/${filename}`;
}

async function fetchProjects() {
    console.log('Fetching projects from GitHub API...');

    const headers = createHeaders();

    const response = await fetch(GITHUB_API_URL, { headers });
    
    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const repos = await response.json();
    
    // Filter and transform repos
    const projects = [];
    
    // Use a subset of projects for efficiency or the full list
    const filteredRepos = repos
        .filter(repo => {
            if (EXCLUDED_REPOS.includes(repo.name)) return false;
            if (!repo.private) return true;
            return isPublicPortfolioUrl(repo.homepage);
        })
        .sort((a, b) => {
            const flagshipA = FLAGSHIP_REPOS.indexOf(a.name);
            const flagshipB = FLAGSHIP_REPOS.indexOf(b.name);

            if (flagshipA !== -1 || flagshipB !== -1) {
                if (flagshipA === -1) return 1;
                if (flagshipB === -1) return -1;
                return flagshipA - flagshipB;
            }

            return new Date(b.pushed_at) - new Date(a.pushed_at);
        })
        .slice(0, MAX_PROJECTS);

    for (const [index, repo] of filteredRepos.entries()) {
        console.log(`Processing ${repo.name}...`);
        const readmeContent = await fetchReadme(repo.name, headers);
        let imageUrl = extractFirstImage(readmeContent, repo.name, repo.default_branch);

        if (repo.private && imageUrl) {
            try {
                imageUrl = await cachePrivateProjectImage(repo.name, imageUrl, headers);
            } catch (error) {
                console.warn(error.message);
                imageUrl = null;
            }
        }

        if (repo.private && !imageUrl) {
            imageUrl = cachedPrivateProjectImage(repo.name);
        }

        projects.push({
            name: repo.name,
            description: repo.description || '',
            htmlUrl: repo.html_url,
            homepageUrl: repo.homepage || null,
            updatedAt: repo.updated_at,
            imageUrl: imageUrl,
            topics: repo.topics || [],
            isPrivate: repo.private
        });
    }

    // Only include projects that have a screenshot, description, and tags.
    // Private repos also need a public TRE homepage and never expose GitHub links.
    const completeProjects = projects.filter(p =>
        p.imageUrl &&
        p.description &&
        p.topics.length > 0 &&
        (!p.isPrivate || isPublicPortfolioUrl(p.homepageUrl))
    );

    console.log(`Found ${projects.length} repos, ${completeProjects.length} with image, description, and tags`);
    return completeProjects;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function generateProjectCard(project, index) {
    const showGithubLink = !project.isPrivate;
    const linkCount = (project.homepageUrl ? 1 : 0) + (showGithubLink ? 1 : 0);
    const linksClass = linkCount === 1 ? ' project-links-full' : '';
    const btnClass = linkCount === 1 ? ' project-btn-full' : '';

    const websiteLink = project.homepageUrl ? `
                                         <a href="${project.homepageUrl}" target="_blank" rel="noopener noreferrer" class="project-btn${btnClass}" data-testid="project-website">
                                             <div class="btn-fill"></div>
                                             <span class="btn-text">Website</span>
                                         </a>` : '';

    const githubLink = showGithubLink ? `
                                        <a href="${project.htmlUrl}" target="_blank" rel="noopener noreferrer" class="project-btn${btnClass}" data-testid="project-github">
                                            <div class="btn-fill"></div>
                                            <span class="btn-text">GitHub</span>
                                        </a>` : '';

    const imageHtml = project.imageUrl ? `
                                 <div class="project-image-container">
                                     <img src="${project.imageUrl}" alt="${project.name} screenshot" class="project-image" loading="lazy" onerror="this.closest('.project-image-container').classList.add('placeholder');this.remove()">
                                 </div>` : `
                                 <div class="project-image-container placeholder">
                                     <div class="placeholder-overlay"></div>
                                     <svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                         <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                         <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                         <polyline points="21 15 16 10 5 21"></polyline>
                                     </svg>
                                 </div>`;

    const randomDelay = (((index * 7 + 3) % 10) * -1).toFixed(2); // Deterministic per-card animation offset
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
                                    ${project.topics.slice(0, 6).map(topic => `<span class="topic-tag">${escapeHtml(topic)}</span>`).join('')}
                                </div>
                                <div class="project-footer">

                                    <div class="project-links${linksClass}">${websiteLink}${githubLink}
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
    return projects.map((project, index) => generateProjectCard(project, index)).join('\n');
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
    const newHtml = (html.slice(0, startIndex) + '\n' + projectsHtml + '\n                    ' + html.slice(endIndex))
        .replace(/[ \t]+$/gm, '');
    
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
