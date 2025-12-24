#include <stdio.h>
#include <stdbool.h>

#define MAX 100000

bool is_prime(int n) {
    if (n < 2) return false;
    for (int i = 2; i < n; i++) {
        if (n % i == 0) return false;
    }
    return true;
}

int main() {
    int count = 0;
    long long sum = 0;
    
    for (int i = 2; i < MAX; i++) {
        if (is_prime(i)) {
            count++;
            sum += i;
        }
    }
    
    printf("%d %lld\n", count, sum);
    return 0;
}