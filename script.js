// TRE Website Static - JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Smooth scrolling for navigation links
    initSmoothScroll();
    
    // Logo entrance animation
    initLogoAnimation();
    
    // Update footer year dynamically
    updateFooterYear();
});

/**
 * Initialize smooth scrolling for anchor links
 */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                const headerOffset = 80; // Account for sticky header
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/**
 * Initialize logo entrance animation
 */
function initLogoAnimation() {
    const heroLogo = document.querySelector('.hero-logo');
    if (heroLogo) {
        // Add staggered animation to logo elements
        const logoBar = heroLogo.querySelector('.logo-bar');
        const logoTriangle = heroLogo.querySelector('.logo-triangle');
        const logoCircle = heroLogo.querySelector('.logo-circle');
        
        if (logoBar) {
            logoBar.style.opacity = '0';
            setTimeout(() => {
                logoBar.style.transition = 'opacity 0.8s ease-out';
                logoBar.style.opacity = '1';
            }, 1200);
        }
        
        if (logoTriangle) {
            logoTriangle.style.opacity = '0';
            setTimeout(() => {
                logoTriangle.style.transition = 'opacity 0.8s ease-out';
                logoTriangle.style.opacity = '1';
            }, 100);
        }
        
        if (logoCircle) {
            logoCircle.style.opacity = '0';
            setTimeout(() => {
                logoCircle.style.transition = 'opacity 0.8s ease-out';
                logoCircle.style.opacity = '1';
            }, 300);
        }
    }
}

/**
 * Update footer year to current year
 */
function updateFooterYear() {
    const footerText = document.querySelector('.footer-text');
    if (footerText) {
        const currentYear = new Date().getFullYear();
        footerText.textContent = `© ${currentYear} Total Reality Engineering. Built with innovation.`;
    }
}
