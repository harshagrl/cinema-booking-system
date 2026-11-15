import prisma from '../config/database.js';

export class ReportService {
  /**
   * 1. High-level KPI overview metrics
   */
  static async getOverviewReport() {
    const [
      totalBookings,
      confirmedBookings,
      cancelledBookings,
      pendingBookings,
      expiredBookings,
      paymentAggregate,
      refundAggregate,
      totalTickets,
      ticketsUsed,
      ticketsValid,
      ticketsCancelled,
    ] = await Promise.all([
      prisma.booking.count(),
      prisma.booking.count({ where: { status: 'CONFIRMED' } }),
      prisma.booking.count({ where: { status: 'CANCELLED' } }),
      prisma.booking.count({ where: { status: { in: ['PENDING', 'PENDING_PAYMENT'] } } }),
      prisma.booking.count({ where: { status: 'EXPIRED' } }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'SUCCESS' },
      }),
      prisma.refund.aggregate({
        _sum: { amount: true },
        where: { status: 'PROCESSED' },
      }),
      prisma.ticket.count(),
      prisma.ticket.count({ where: { status: 'USED' } }),
      prisma.ticket.count({ where: { status: 'VALID' } }),
      prisma.ticket.count({ where: { status: 'CANCELLED' } }),
    ]);

    const grossRevenue = Number(paymentAggregate._sum.amount || 0);
    const totalRefunds = Number(refundAggregate._sum.amount || 0);
    const netRevenue = Number((grossRevenue - totalRefunds).toFixed(2));
    const cancellationRate =
      totalBookings > 0
        ? Number(((cancelledBookings / totalBookings) * 100).toFixed(1))
        : 0;

    return {
      bookings: {
        total: totalBookings,
        confirmed: confirmedBookings,
        cancelled: cancelledBookings,
        pending: pendingBookings,
        expired: expiredBookings,
        cancellationRate,
      },
      revenue: {
        grossRevenue,
        totalRefunds,
        netRevenue,
        currency: 'INR',
      },
      tickets: {
        total: totalTickets,
        used: ticketsUsed,
        valid: ticketsValid,
        cancelled: ticketsCancelled,
      },
    };
  }

  /**
   * 2. Show occupancy and performance reports
   */
  static async getShowsReport({
    movieId,
    theatreId,
    startDate,
    endDate,
    page = 1,
    limit = 20,
  }) {
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where = {};

    if (movieId) {
      where.movieId = movieId;
    }

    if (theatreId) {
      where.screen = { theatreId };
    }

    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate);
      if (endDate) where.startTime.lte = new Date(endDate);
    }

    const [totalShows, shows] = await Promise.all([
      prisma.show.count({ where }),
      prisma.show.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { startTime: 'desc' },
        include: {
          movie: { select: { id: true, title: true, duration: true, posterUrl: true } },
          screen: {
            include: {
              theatre: { select: { id: true, name: true, city: true } },
              seats: { where: { isActive: true }, select: { id: true } },
            },
          },
          showSeats: {
            select: { id: true, status: true, price: true },
          },
        },
      }),
    ]);

    const data = shows.map((s) => {
      const totalSeats = s.screen?.seats?.length || s.screen?.capacity || s.showSeats.length;
      const bookedSeats = s.showSeats.filter((ss) => ss.status === 'BOOKED').length;
      const availableSeats = s.showSeats.filter((ss) => ss.status === 'AVAILABLE').length;
      const heldSeats = s.showSeats.filter((ss) => ss.status === 'HELD').length;
      const occupancyPercentage =
        totalSeats > 0 ? Number(((bookedSeats / totalSeats) * 100).toFixed(1)) : 0;

      const grossShowRevenue = s.showSeats
        .filter((ss) => ss.status === 'BOOKED')
        .reduce((sum, ss) => sum + Number(ss.price), 0);

      return {
        showId: s.id,
        movie: s.movie,
        theatre: s.screen?.theatre,
        screenName: s.screen?.name,
        screenFormat: s.format,
        startTime: s.startTime,
        endTime: s.endTime,
        isActive: s.isActive,
        seats: {
          total: totalSeats,
          booked: bookedSeats,
          available: availableSeats,
          held: heldSeats,
          occupancyPercentage,
        },
        revenue: Number(grossShowRevenue.toFixed(2)),
      };
    });

    return {
      data,
      pagination: {
        total: totalShows,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalShows / limitNum) || 1,
      },
    };
  }

  /**
   * 3. Revenue report with movie breakdown and date filtering
   */
  static async getRevenueReport({ startDate, endDate } = {}) {
    const paymentWhere = { status: 'SUCCESS' };
    const refundWhere = { status: 'PROCESSED' };

    if (startDate || endDate) {
      paymentWhere.createdAt = {};
      refundWhere.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        paymentWhere.createdAt.gte = start;
        refundWhere.createdAt.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        paymentWhere.createdAt.lte = end;
        refundWhere.createdAt.lte = end;
      }
    }

    const [grossAgg, refundAgg, movies] = await Promise.all([
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: paymentWhere,
      }),
      prisma.refund.aggregate({
        _sum: { amount: true },
        where: refundWhere,
      }),
      prisma.movie.findMany({
        where: { isActive: true },
        select: {
          id: true,
          title: true,
          posterUrl: true,
          shows: {
            select: {
              bookings: {
                where: {
                  ...(startDate || endDate
                    ? {
                        createdAt: {
                          ...(startDate ? { gte: new Date(startDate) } : {}),
                          ...(endDate ? { lte: new Date(endDate) } : {}),
                        },
                      }
                    : {}),
                },
                select: {
                  id: true,
                  status: true,
                  payments: {
                    where: { status: 'SUCCESS' },
                    select: { amount: true },
                  },
                  refunds: {
                    where: { status: 'PROCESSED' },
                    select: { amount: true },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const grossRevenue = Number(grossAgg._sum.amount || 0);
    const totalRefunds = Number(refundAgg._sum.amount || 0);
    const netRevenue = Number((grossRevenue - totalRefunds).toFixed(2));

    // Calculate revenue breakdown by movie
    const byMovie = movies
      .map((m) => {
        let bookingCount = 0;
        let movieGross = 0;
        let movieRefund = 0;

        for (const show of m.shows || []) {
          for (const b of show.bookings || []) {
            if (b.status === 'CONFIRMED' || b.status === 'CANCELLED') {
              bookingCount++;
              for (const p of b.payments || []) {
                movieGross += Number(p.amount);
              }
              for (const r of b.refunds || []) {
                movieRefund += Number(r.amount);
              }
            }
          }
        }

        return {
          movieId: m.id,
          title: m.title,
          posterUrl: m.posterUrl,
          bookingCount,
          grossRevenue: Number(movieGross.toFixed(2)),
          refundAmount: Number(movieRefund.toFixed(2)),
          netRevenue: Number((movieGross - movieRefund).toFixed(2)),
        };
      })
      .sort((a, b) => b.netRevenue - a.netRevenue);

    return {
      summary: {
        grossRevenue,
        totalRefunds,
        netRevenue,
        currency: 'INR',
        period: {
          startDate: startDate || null,
          endDate: endDate || null,
        },
      },
      byMovie,
    };
  }

  /**
   * 4. Booking counts by status and paginated detailed booking log
   */
  static async getBookingsReport({
    status,
    startDate,
    endDate,
    page = 1,
    limit = 20,
  }) {
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where = {};

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [
      totalMatching,
      confirmedCount,
      cancelledCount,
      pendingCount,
      expiredCount,
      bookings,
    ] = await Promise.all([
      prisma.booking.count({ where }),
      prisma.booking.count({ where: { status: 'CONFIRMED' } }),
      prisma.booking.count({ where: { status: 'CANCELLED' } }),
      prisma.booking.count({ where: { status: { in: ['PENDING', 'PENDING_PAYMENT'] } } }),
      prisma.booking.count({ where: { status: 'EXPIRED' } }),
      prisma.booking.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          show: {
            include: {
              movie: { select: { id: true, title: true } },
              screen: {
                include: { theatre: { select: { id: true, name: true, city: true } } },
              },
            },
          },
          seats: {
            include: { showSeat: { include: { seat: true } } },
          },
          payments: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          refunds: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
    ]);

    const data = bookings.map((b) => ({
      id: b.id,
      bookingReference: b.bookingReference,
      status: b.status,
      totalAmount: Number(b.totalAmount),
      createdAt: b.createdAt,
      customer: b.user,
      movieTitle: b.show?.movie?.title,
      theatreName: b.show?.screen?.theatre?.name,
      screenName: b.show?.screen?.name,
      showStartTime: b.show?.startTime,
      seatCount: b.seats.length,
      seats: b.seats.map((bs) => `${bs.showSeat?.seat?.row}${bs.showSeat?.seat?.seatNumber}`),
      latestPayment: b.payments[0]
        ? {
            id: b.payments[0].id,
            status: b.payments[0].status,
            amount: Number(b.payments[0].amount),
            transactionReference: b.payments[0].transactionReference,
          }
        : null,
      latestRefund: b.refunds[0]
        ? {
            id: b.refunds[0].id,
            status: b.refunds[0].status,
            amount: Number(b.refunds[0].amount),
            refundReference: b.refunds[0].refundReference,
          }
        : null,
    }));

    return {
      statusDistribution: {
        CONFIRMED: confirmedCount,
        CANCELLED: cancelledCount,
        PENDING_PAYMENT: pendingCount,
        EXPIRED: expiredCount,
      },
      data,
      pagination: {
        total: totalMatching,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalMatching / limitNum) || 1,
      },
    };
  }
}
