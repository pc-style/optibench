#include <stdio.h>

long long fibonacci(int n) {
    if (n <= 1) return n;
    long long a = 0, b = 1, c;
    for (int i = 2; i <= n; i++) {
        c = a + b;
        a = b;
        b = c;
    }
    return b;
}

int main() {
    long long sum = 0;
    for (int i = 0; i < 40; i++) {
        sum += fibonacci(i);
    }
    printf("%lld\n", sum);
    return 0;
}