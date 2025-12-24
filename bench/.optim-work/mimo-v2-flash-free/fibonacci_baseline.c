#include <stdio.h>

long long fibonacci(int n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

int main() {
    long long sum = 0;
    for (int i = 0; i < 40; i++) {
        sum += fibonacci(i);
    }
    printf("%lld\n", sum);
    return 0;
}