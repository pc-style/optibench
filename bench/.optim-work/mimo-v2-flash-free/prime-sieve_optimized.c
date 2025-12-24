#include <stdio.h>
#include <stdbool.h>
#include <math.h>
#include <string.h>

#define MAX 100000

static bool is_prime_optimized(int n) {
    if (n < 2) return false;
    if (n == 2) return true;
    if (n % 2 == 0) return false;
    int limit = (int)sqrt(n);
    for (int i = 3; i <= limit; i += 2) {
        if (n % i == 0) return false;
    }
    return true;
}

int main() {
    int count = 0;
    long long sum = 0;
    
    // Handle 2 separately
    count = 1;
    sum = 2;
    
    // Unroll loop by 2, handle odd numbers only
    for (int i = 3; i < MAX; i += 2) {
        if (is_prime_optimized(i)) {
            count++;
            sum += i;
        }
        int next = i + 2;
        if (next < MAX && is_prime_optimized(next)) {
            count++;
            sum += next;
        }
        i += 2; // Additional increment to skip evens
    }
    
    printf("%d %lld\n", count, sum);
    return 0;
}